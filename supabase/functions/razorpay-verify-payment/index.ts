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
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
    .toUpperCase();
  return `${payload}-SIG:${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prefer gateway_secrets table, fall back to env vars
    const { data: secretRows } = await supabase
      .from("gateway_secrets")
      .select("key, value")
      .eq("key", "razorpay_key_secret");

    const dbSecret = (secretRows as { key: string; value: string }[] | null)?.find(r => r.key === "razorpay_key_secret")?.value;
    const keySecret = (dbSecret && dbSecret.length > 0 ? dbSecret : null) || Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) throw new Error("Razorpay secret not configured");

    // Verify HMAC-SHA256 signature
    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureBody));
    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedSignature !== razorpay_signature) {
      return new Response(
        JSON.stringify({ verified: false, error: "Signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    // IDEMPOTENCY: Check if tickets already exist for this order
    const { data: existingTickets, error: ticketCheckErr } = await supabase
      .from("tickets")
      .select("*")
      .eq("order_id", order.id);

    if (!ticketCheckErr && existingTickets && existingTickets.length > 0) {
      // Tickets already generated — return them without re-creating
      console.log("Tickets already exist for order", order.id, "— returning existing tickets");
      return new Response(
        JSON.stringify({ verified: true, tickets: existingTickets, idempotent: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IDEMPOTENCY: If already paid_verified but no tickets found, still generate
    // Update order to paid_verified and store Razorpay IDs
    await supabase
      .from("orders")
      .update({
        payment_status: "paid_verified",
        payment_verified_at: new Date().toISOString(),
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        gateway_response: {
          razorpay_order_id,
          razorpay_payment_id,
          verified_at: new Date().toISOString(),
          source: "frontend",
        },
      } as any)
      .eq("id", order_id);

    // Generate tickets
    const tickets: any[] = [];
    for (let i = 0; i < order.seats_count; i++) {
      const qrText = await generateSignedQR(order.match_id, order.purchaser_mobile, i, hmacSecret);
      const { data: ticket } = await supabase
        .from("tickets")
        .insert({
          match_id: order.match_id,
          event_id: order.event_id,
          order_id: order.id,
          seat_index: i,
          qr_text: qrText,
          status: "active",
        })
        .select()
        .single();
      if (ticket) tickets.push(ticket);
    }

    return new Response(
      JSON.stringify({ verified: true, tickets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
