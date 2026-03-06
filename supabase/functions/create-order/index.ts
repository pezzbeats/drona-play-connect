import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { match_id, purchaser_full_name, purchaser_email, seating_type, seats_count, payment_method, pricing_snapshot, created_source, admin_id } = body;
    const purchaser_mobile = body.purchaser_mobile?.toString().replace(/\D/g, "").slice(-10);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";

    // ── Rate limiting: max 5 orders per mobile per 10 minutes ──
    // Skip rate limiting for admin-created orders
    if (!admin_id && purchaser_mobile) {
      const limitKey = `order:${purchaser_mobile}`;
      const allowed = await checkRateLimit(supabase, limitKey, 5, 600_000);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Too many orders. Please wait before trying again.", code: "RATE_LIMITED", retryable: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get match + event
    const { data: match } = await supabase.from("matches").select("*, events(id)").eq("id", match_id).single();
    if (!match) throw new Error("Match not found");

    const canGenerate = payment_method === "pay_at_hotel" || payment_method === "cash" || payment_method === "card";

    // Create order
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      match_id,
      event_id: match.event_id,
      purchaser_full_name,
      purchaser_mobile,
      purchaser_email: purchaser_email || null,
      seating_type: seating_type || "regular",
      seats_count,
      total_amount: pricing_snapshot?.total ?? 0,
      pricing_model_snapshot: pricing_snapshot ?? {},
      payment_method,
      payment_status: "unpaid",
      created_source: created_source || "self_register",
      created_by_admin_id: admin_id || null,
    }).select().single();

    if (orderError) throw new Error(orderError.message);

    // Generate HMAC-signed tickets only if pay_at_hotel / cash / card
    let tickets: any[] = [];
    if (canGenerate) {
      for (let i = 0; i < seats_count; i++) {
        const qrText = await generateSignedQR(match_id, purchaser_mobile, i, hmacSecret);
        const { data: ticket } = await supabase.from("tickets").insert({
          match_id, event_id: match.event_id, order_id: order.id,
          seat_index: i, qr_text: qrText, status: "active",
        }).select().single();
        if (ticket) tickets.push(ticket);
      }
    }

    return new Response(JSON.stringify({ order_id: order.id, tickets }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, code: "INTERNAL_ERROR", retryable: false }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
