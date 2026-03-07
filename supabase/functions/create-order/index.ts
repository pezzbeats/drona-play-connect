import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(error: string, code = "ERROR") {
  return new Response(JSON.stringify({ success: false, error, code }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

async function checkRateLimit(supabase: any, key: string, limitCount: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  await supabase.from("rate_limit_events").delete().eq("key", key).lt("created_at", new Date(Date.now() - 600_000).toISOString());
  const { count } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= limitCount) return false;
  await supabase.from("rate_limit_events").insert({ key });
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      match_id, purchaser_full_name, purchaser_mobile, purchaser_email,
      seating_type, seats_count, payment_method, pricing_snapshot,
      created_source, admin_id,
      advance_paid, advance_payment_method,
      discount_type, discount_value,
    } = body;

    // Basic validation
    if (!match_id) return fail("match_id is required", "VALIDATION_ERROR");
    if (!purchaser_full_name) return fail("purchaser_full_name is required", "VALIDATION_ERROR");
    if (!purchaser_mobile) return fail("purchaser_mobile is required", "VALIDATION_ERROR");
    if (!payment_method) return fail("payment_method is required", "VALIDATION_ERROR");
    if (!seats_count || seats_count < 1) return fail("seats_count must be at least 1", "VALIDATION_ERROR");

    // ── Discount computation ──
    const subtotal = pricing_snapshot?.total ?? 0;
    let discountAmount = 0;

    if (discount_type && discount_value != null) {
      const discountVal = parseFloat(discount_value) || 0;

      if (discount_type === "flat") {
        if (discountVal < 0) return fail("Discount cannot be negative", "VALIDATION_ERROR");
        if (discountVal > subtotal) return fail(`Flat discount ₹${discountVal} cannot exceed subtotal ₹${subtotal}`, "VALIDATION_ERROR");
        discountAmount = Math.floor(discountVal);
      } else if (discount_type === "percent") {
        if (discountVal < 0 || discountVal > 100) return fail("Percent discount must be between 0 and 100", "VALIDATION_ERROR");
        discountAmount = Math.floor(subtotal * discountVal / 100);
      }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);
    const advancePaidAmount = Math.min(Math.max(parseInt(advance_paid ?? 0) || 0, 0), totalAmount);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";

    // ── Rate limiting: max 5 orders per mobile per 10 minutes ──
    if (!admin_id && purchaser_mobile) {
      const limitKey = `order:${purchaser_mobile}`;
      const allowed = await checkRateLimit(supabase, limitKey, 5, 600_000);
      if (!allowed) {
        return fail("Too many orders. Please wait before trying again.", "RATE_LIMITED");
      }
    }

    // Get match + event
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*, events(id)")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      console.error("Match lookup error:", matchError);
      return fail(`Match not found: ${matchError?.message || "unknown error"}`, "MATCH_NOT_FOUND");
    }

    // Determine payment status
    const isFullyPaid = advancePaidAmount >= totalAmount && totalAmount > 0;
    const paymentStatus = isFullyPaid ? "paid_manual_verified" : "unpaid";

    const canGenerate = payment_method === "pay_at_hotel"
      || payment_method === "cash"
      || payment_method === "card"
      || payment_method === "upi"
      || isFullyPaid;

    // Create order
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      match_id,
      event_id: match.event_id,
      purchaser_full_name,
      purchaser_mobile,
      purchaser_email: purchaser_email || null,
      seating_type: seating_type || "regular",
      seats_count,
      total_amount: totalAmount,
      pricing_model_snapshot: pricing_snapshot ?? {},
      payment_method,
      payment_status: paymentStatus,
      created_source: created_source || "self_register",
      created_by_admin_id: admin_id || null,
      advance_paid: advancePaidAmount,
      advance_payment_method: advancePaidAmount > 0 ? (advance_payment_method || null) : null,
      discount_type: discountAmount > 0 ? (discount_type || null) : null,
      discount_value: discountAmount > 0 ? (parseFloat(discount_value) || 0) : 0,
      discount_amount: discountAmount,
      ...(isFullyPaid ? {
        payment_verified_at: new Date().toISOString(),
        payment_verified_by_admin_id: admin_id || null,
      } : {}),
    } as any).select().single();

    if (orderError) {
      console.error("Order insert error:", orderError);
      return fail(`Failed to create order: ${orderError.message}`, "ORDER_INSERT_ERROR");
    }

    // Generate HMAC-signed tickets for all manual-payment methods
    let tickets: any[] = [];
    if (canGenerate) {
      for (let i = 0; i < seats_count; i++) {
        const qrText = await generateSignedQR(match_id, purchaser_mobile, i, hmacSecret);
        const { data: ticket, error: ticketError } = await supabase.from("tickets").insert({
          match_id, event_id: match.event_id, order_id: order.id,
          seat_index: i, qr_text: qrText, status: "active",
        }).select().single();
        if (ticketError) {
          console.error("Ticket insert error:", ticketError);
        }
        if (ticket) tickets.push(ticket);
      }
    }

    // Record advance payment collection if advance was paid
    if (advancePaidAmount > 0 && admin_id) {
      const methodMap: Record<string, string> = { cash: "cash", card: "card", upi: "upi" };
      const collectionMethod = methodMap[advance_payment_method] || "cash";
      await supabase.from("payment_collections").insert({
        order_id: order.id,
        collected_by_admin_id: admin_id,
        method: collectionMethod,
        amount: advancePaidAmount,
        note: `Advance payment at booking (${advancePaidAmount < totalAmount ? `balance ₹${totalAmount - advancePaidAmount} due` : "full payment"})${discountAmount > 0 ? ` · discount ₹${discountAmount} applied` : ""}`,
      } as any);
    }

    return ok({
      order_id: order.id,
      tickets,
      advance_paid: advancePaidAmount,
      balance_due: totalAmount - advancePaidAmount,
      discount_amount: discountAmount,
      final_total: totalAmount,
    });

  } catch (e: any) {
    console.error("create-order unhandled error:", e);
    return fail(e.message || "An unexpected error occurred", "INTERNAL_ERROR");
  }
});
