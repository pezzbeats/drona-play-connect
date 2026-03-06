import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYEE_VPA = "paytmqr5oka4x@ptys";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orderId = formData.get("order_id") as string;
    const uploadedBy = (formData.get("uploaded_by") as string) || "customer";

    if (!file || !orderId) throw new Error("File and order_id required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Compute file hash
    const buffer = await file.arrayBuffer();
    const sha256 = await computeSHA256(buffer);

    // Check duplicate file
    const { data: existingHash } = await supabase.from("payment_proofs").select("id, order_id, ai_verdict").eq("file_sha256", sha256).single();
    if (existingHash) {
      return new Response(JSON.stringify({ verdict: "rejected", reason: "Duplicate payment proof (file already used)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get order details
    const { data: order } = await supabase.from("orders").select("total_amount").eq("id", orderId).single();
    if (!order) throw new Error("Order not found");

    // Upload file to storage
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${orderId}/${sha256.slice(0, 8)}.${ext}`;
    await supabase.storage.from("payment-proofs").upload(path, buffer, { contentType: file.type, upsert: false });

    let extractedAmount: number | null = null;
    let extractedTxnId: string | null = null;
    let extractedVpa: string | null = null;
    let extractedDate: string | null = null;
    let aiVerdict: "verified" | "rejected" | "needs_manual_review" = "needs_manual_review";
    let aiReason = "Could not process file automatically";

    // AI extraction via Lovable AI (Gemini Vision)
    if (LOVABLE_API_KEY && file.type.startsWith("image/")) {
      try {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const aiResponse = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Extract payment details from this UPI payment screenshot. Return JSON only with these fields: { "amount": number_in_rupees_or_null, "txn_id": "string_or_null", "vpa": "payee_upi_id_or_null", "date": "date_string_or_null", "status": "success|failed|pending|unknown" }. No markdown, just JSON.` },
                { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
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

        // Check for duplicate txn_id
        if (extractedTxnId) {
          const { data: dupTxn } = await supabase.from("payment_proofs").select("id, order_id").eq("extracted_txn_id", extractedTxnId).eq("ai_verdict", "verified").neq("order_id", orderId).single();
          if (dupTxn) {
            aiVerdict = "rejected";
            aiReason = `Duplicate transaction ID (already used for another order)`;
          } else if (parsed.status === "success" && extractedAmount && extractedAmount >= order.total_amount && extractedVpa && extractedVpa.toLowerCase().includes(PAYEE_VPA.split("@")[0])) {
            aiVerdict = "verified";
            aiReason = `Amount ₹${extractedAmount} verified. TXN: ${extractedTxnId}`;
          } else if (parsed.status === "failed") {
            aiVerdict = "rejected";
            aiReason = "Payment screenshot shows FAILED status";
          } else {
            aiVerdict = "needs_manual_review";
            aiReason = `Amount: ₹${extractedAmount || "?"}, Status: ${parsed.status || "unknown"}. Please verify manually.`;
          }
        } else {
          aiVerdict = "needs_manual_review";
          aiReason = "Could not extract transaction ID. Manual review required.";
        }
      } catch (e) {
        aiVerdict = "needs_manual_review";
        aiReason = "AI extraction failed. Manual review required.";
      }
    }

    // Save proof record
    await supabase.from("payment_proofs").insert({
      order_id: orderId, uploaded_by: uploadedBy as any, file_path: path, file_sha256: sha256,
      extracted_amount: extractedAmount, extracted_txn_id: extractedTxnId, extracted_vpa: extractedVpa,
      extracted_date: extractedDate, ai_verdict: aiVerdict, ai_reason: aiReason,
    });

    // Update order status
    if (aiVerdict === "verified") {
      await supabase.from("orders").update({ payment_status: "paid_verified", payment_verified_at: new Date().toISOString() } as any).eq("id", orderId);
      // Generate tickets
      const { data: order2 } = await supabase.from("orders").select("*, tickets(id)").eq("id", orderId).single();
      if ((order2 as any)?.tickets?.length === 0) {
        for (let i = 0; i < (order2 as any).seats_count; i++) {
          const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
          const qrText = `T20FN-${(order2 as any).match_id.slice(0, 8)}-${(order2 as any).purchaser_mobile}-S${i + 1}-${Date.now()}-${rand}`;
          await supabase.from("tickets").insert({ match_id: (order2 as any).match_id, event_id: (order2 as any).event_id, order_id: orderId, seat_index: i, qr_text: qrText, status: "active" });
        }
      }
    } else if (aiVerdict === "rejected") {
      await supabase.from("orders").update({ payment_status: "paid_rejected" } as any).eq("id", orderId);
    } else {
      await supabase.from("orders").update({ payment_status: "pending_verification" } as any).eq("id", orderId);
    }

    return new Response(JSON.stringify({ verdict: aiVerdict, reason: aiReason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
