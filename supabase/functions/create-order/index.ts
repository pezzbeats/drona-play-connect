import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateQRText(matchId: string, mobile: string, seatIndex: number): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `T20FN-${matchId.slice(0, 8)}-${mobile}-S${seatIndex + 1}-${ts}-${rand}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { match_id, purchaser_full_name, purchaser_mobile, purchaser_email, seating_type, seats_count, payment_method, pricing_snapshot, created_source, admin_id } = body;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get match + event
    const { data: match } = await supabase.from("matches").select("*, events(id)").eq("id", match_id).single();
    if (!match) throw new Error("Match not found");

    // Determine initial payment status
    const canGenerate = payment_method === "pay_at_hotel" || payment_method === "cash" || payment_method === "card";
    const paymentStatus = canGenerate ? "unpaid" : "unpaid";

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
      payment_status: paymentStatus,
      created_source: created_source || "self_register",
      created_by_admin_id: admin_id || null,
    }).select().single();

    if (orderError) throw new Error(orderError.message);

    // Generate tickets only if pay_at_hotel / cash / card
    let tickets: any[] = [];
    if (canGenerate) {
      for (let i = 0; i < seats_count; i++) {
        const qrText = generateQRText(match_id, purchaser_mobile, i);
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
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
