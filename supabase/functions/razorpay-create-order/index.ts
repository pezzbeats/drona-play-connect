import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, amount_paise, currency = "INR", receipt } = await req.json();

    if (!order_id || !amount_paise) {
      return new Response(JSON.stringify({ error: "order_id and amount_paise are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify order exists
    const { data: existingOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("id, total_amount, payment_status")
      .eq("id", order_id)
      .single();

    if (orderFetchError || !existingOrder) {
      throw new Error("Order not found");
    }

    // Create Razorpay order
    const auth = btoa(`${keyId}:${keySecret}`);
    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount_paise,
        currency,
        receipt: receipt || `order_${order_id.slice(0, 12)}`,
        notes: { internal_order_id: order_id },
      }),
    });

    if (!razorpayRes.ok) {
      const errBody = await razorpayRes.text();
      throw new Error(`Razorpay API error: ${errBody}`);
    }

    const razorpayOrder = await razorpayRes.json();

    // Store razorpay_order_id on our order
    await supabase
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id } as any)
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: keyId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
