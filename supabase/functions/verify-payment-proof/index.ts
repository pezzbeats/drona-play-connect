import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYEE_VPA_PREFIX = "paytmqr5oka4x";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function computeAiConfidence(fields: { amount: any; txnId: any; vpa: any; date: any }, status: string): string {
  if (!fields.amount && !fields.txnId && !fields.vpa && !fields.date) return "none";
  const extractedCount = [fields.amount, fields.txnId, fields.vpa, fields.date].filter(Boolean).length;
  if (extractedCount === 4 && status === "success") return "high";
  if (extractedCount >= 3) return "medium";
  return "low";
}

async function generateSignedQR(matchId: string, mobile: string, seatIndex: number, secret: string): Promise<string> {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const payload = `T20FN-${matchId.slice(0, 8)}-${mobile}-S${seatIndex + 1}-${ts}-${rand}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16).toUpperCase();
  return `${payload}-SIG:${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orderId = formData.get("order_id") as string;
    const uploadedBy = (formData.get("uploaded_by") as string) || "customer";

    if (!file || !orderId) throw new Error("File and order_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const hmacSecret = LOVABLE_API_KEY || "fallback-secret";

    // --- Step 1: Compute file hash ---
    const buffer = await file.arrayBuffer();
    const sha256 = await computeSHA256(buffer);

    // --- Step 2: Check duplicate file hash ---
    const { data: existingHash } = await supabase
      .from("payment_proofs")
      .select("id, order_id, ai_verdict")
      .eq("file_sha256", sha256)
      .maybeSingle();

    if (existingHash) {
      return new Response(
        JSON.stringify({ verdict: "rejected", reason: "Duplicate payment proof (file already used)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Step 3: Get order details ---
    const { data: order } = await supabase
      .from("orders")
      .select("total_amount, purchaser_mobile, match_id, event_id, seats_count")
      .eq("id", orderId)
      .single();
    if (!order) throw new Error("Order not found");

    // --- Step 4: Upload file to storage ---
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${orderId}/${sha256.slice(0, 8)}.${ext}`;
    await supabase.storage
      .from("payment-proofs")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    let extractedAmount: number | null = null;
    let extractedTxnId: string | null = null;
    let extractedVpa: string | null = null;
    let extractedDate: string | null = null;
    let aiVerdict: "verified" | "rejected" | "needs_manual_review" = "needs_manual_review";
    let aiReason = "Could not process file automatically";
    let aiConfidence = "none";
    const fraudFlags: string[] = [];
    let parsedStatus = "unknown";

    // --- Step 5: AI extraction (images + PDF as base64) ---
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (LOVABLE_API_KEY && (isImage || isPdf)) {
      try {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const mediaType = isPdf ? "application/pdf" : file.type;

        const aiResponse = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract payment details from this UPI payment screenshot or PDF. Return JSON only with these fields: { "amount": number_in_rupees_or_null, "txn_id": "string_or_null", "vpa": "payee_upi_id_or_null", "date": "date_string_or_null", "status": "success|failed|pending|unknown" }. No markdown, just JSON.`
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mediaType};base64,${base64}` }
                }
              ]
            }]
          })
        });

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());

        extractedAmount = parsed.amount || null;
        extractedTxnId = parsed.txn_id || null;
        extractedVpa = parsed.vpa || null;
        extractedDate = parsed.date || null;
        parsedStatus = parsed.status || "unknown";

        aiConfidence = computeAiConfidence(
          { amount: extractedAmount, txnId: extractedTxnId, vpa: extractedVpa, date: extractedDate },
          parsedStatus
        );

        // --- Step 6: TXN ID duplicate check — ALL proofs (not just verified) ---
        if (extractedTxnId) {
          const { data: dupTxn } = await supabase
            .from("payment_proofs")
            .select("id, order_id, ai_verdict")
            .eq("extracted_txn_id", extractedTxnId)
            .neq("order_id", orderId)
            .maybeSingle();

          if (dupTxn) {
            aiVerdict = "rejected";
            aiReason = `Duplicate transaction ID (TXN ${extractedTxnId} already used in another submission)`;
          }
        }

        // Only continue verdict logic if not already rejected by TXN dupe
        if (aiVerdict !== "rejected") {
          // --- Step 7: VPA mismatch flag ---
          if (extractedVpa && !extractedVpa.toLowerCase().includes(PAYEE_VPA_PREFIX)) {
            fraudFlags.push("vpa_mismatch");
          }

          // --- Step 8: Amount + mobile within 30-min window check ---
          if (extractedAmount) {
            const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const { data: windowDup } = await supabase
              .from("payment_proofs")
              .select("id, order_id")
              .neq("order_id", orderId)
              .eq("extracted_amount", extractedAmount)
              .gte("created_at", windowStart)
              .limit(1)
              .maybeSingle();

            if (windowDup) {
              const { data: windowOrder } = await supabase
                .from("orders")
                .select("purchaser_mobile")
                .eq("id", windowDup.order_id)
                .maybeSingle();

              if (windowOrder?.purchaser_mobile === order.purchaser_mobile) {
                fraudFlags.push("amount_mobile_window");
              }
            }
          }

          // --- Step 9: Determine verdict ---
          if (parsedStatus === "failed") {
            aiVerdict = "rejected";
            aiReason = "Payment screenshot shows FAILED status";
          } else if (fraudFlags.length > 0) {
            aiVerdict = "needs_manual_review";
            aiReason = `Fraud signals detected: ${fraudFlags.join(", ")}. Manual review required.`;
          } else if (
            parsedStatus === "success" &&
            extractedAmount &&
            extractedAmount >= order.total_amount &&
            extractedTxnId &&
            extractedVpa &&
            extractedVpa.toLowerCase().includes(PAYEE_VPA_PREFIX) &&
            aiConfidence !== "low" &&
            aiConfidence !== "none"
          ) {
            aiVerdict = "verified";
            aiReason = `Amount ₹${extractedAmount} verified. TXN: ${extractedTxnId}`;
          } else {
            aiVerdict = "needs_manual_review";
            const missing = [];
            if (!extractedTxnId) missing.push("TXN ID");
            if (!extractedAmount) missing.push("amount");
            if (extractedAmount && extractedAmount < order.total_amount) missing.push(`amount mismatch (got ₹${extractedAmount}, expected ₹${order.total_amount})`);
            aiReason = missing.length > 0
              ? `Could not confirm: ${missing.join(", ")}. Manual review required.`
              : `Status: ${parsedStatus}. Manual review required.`;
          }
        }
      } catch (_e) {
        aiVerdict = "needs_manual_review";
        aiReason = "AI extraction failed. Manual review required.";
        aiConfidence = "none";
      }
    }

    // --- Step 10: Save proof record ---
    await supabase.from("payment_proofs").insert({
      order_id: orderId,
      uploaded_by: uploadedBy as any,
      file_path: path,
      file_sha256: sha256,
      extracted_amount: extractedAmount,
      extracted_txn_id: extractedTxnId,
      extracted_vpa: extractedVpa,
      extracted_date: extractedDate,
      ai_verdict: aiVerdict,
      ai_reason: aiReason,
      ai_confidence: aiConfidence,
      fraud_flags: fraudFlags,
    } as any);

    // --- Step 11: Update order status ---
    if (aiVerdict === "verified") {
      await supabase
        .from("orders")
        .update({
          payment_status: "paid_verified",
          payment_verified_at: new Date().toISOString(),
        } as any)
        .eq("id", orderId);

      // --- Step 12: Generate HMAC-signed tickets safely ---
      const { count: ticketCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);

      if ((ticketCount ?? 0) === 0) {
        for (let i = 0; i < order.seats_count; i++) {
          const qrText = await generateSignedQR(order.match_id, order.purchaser_mobile, i, hmacSecret);
          await supabase.from("tickets").insert({
            match_id: order.match_id,
            event_id: order.event_id,
            order_id: orderId,
            seat_index: i,
            qr_text: qrText,
            status: "active",
          });
        }
      }
    } else if (aiVerdict === "rejected") {
      await supabase
        .from("orders")
        .update({ payment_status: "paid_rejected" } as any)
        .eq("id", orderId);
    } else {
      await supabase
        .from("orders")
        .update({ payment_status: "pending_verification" } as any)
        .eq("id", orderId);
    }

    return new Response(
      JSON.stringify({ verdict: aiVerdict, reason: aiReason, fraud_flags: fraudFlags, confidence: aiConfidence }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
