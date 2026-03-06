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

  // Razorpay webhooks are POST only
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read raw body for signature verification
    const rawBody = await req.text();
    const webhookSignature = req.headers.get("x-razorpay-signature");

    if (!webhookSignature) {
      return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch webhook secret from gateway_secrets table
    const { data: secretRows } = await supabase
      .from("gateway_secrets")
      .select("key, value")
      .eq("key", "razorpay_webhook_secret");

    const webhookSecret = (secretRows as { key: string; value: string }[] | null)
      ?.find(r => r.key === "razorpay_webhook_secret")?.value;

    if (!webhookSecret) {
      console.error("razorpay_webhook_secret not configured in gateway_secrets");
      // Return 200 to prevent Razorpay retries, but log the issue
      return new Response(JSON.stringify({ status: "webhook_secret_not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify HMAC-SHA256 signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const computedSig = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedSig !== webhookSignature) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // Only handle payment.captured
    if (event !== "payment.captured") {
      return new Response(JSON.stringify({ status: "ignored", event }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment) {
      return new Response(JSON.stringify({ error: "No payment entity in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    if (!razorpayOrderId) {
      return new Response(JSON.stringify({ error: "No order_id in payment entity" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up internal order by razorpay_order_id
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpayOrderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found for razorpay_order_id:", razorpayOrderId);
      // Return 200 to prevent Razorpay retries
      return new Response(JSON.stringify({ status: "order_not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY: Check if tickets already exist for this order
    const { data: existingTickets, error: ticketCheckErr } = await supabase
      .from("tickets")
      .select("id")
      .eq("order_id", order.id);

    if (!ticketCheckErr && existingTickets && existingTickets.length > 0) {
      console.log("Tickets already exist for order", order.id, "— skipping (idempotent)");
      return new Response(JSON.stringify({ status: "already_processed", order_id: order.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY: Check if order is already paid_verified
    if (order.payment_status === "paid_verified") {
      return new Response(JSON.stringify({ status: "already_verified", order_id: order.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order to paid_verified
    await supabase
      .from("orders")
      .update({
        payment_status: "paid_verified",
        payment_verified_at: new Date().toISOString(),
        razorpay_payment_id: razorpayPaymentId,
        gateway_response: {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          verified_at: new Date().toISOString(),
          source: "webhook",
        },
      } as any)
      .eq("id", order.id);

    // Generate tickets
    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";
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

    console.log(`Webhook processed: order ${order.id}, ${tickets.length} tickets generated`);

    return new Response(
      JSON.stringify({ status: "success", order_id: order.id, tickets_generated: tickets.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Webhook error:", e.message);
    // Return 200 to prevent Razorpay retries on unexpected errors
    return new Response(JSON.stringify({ status: "error", message: e.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
