import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, seats_count, seating_type, match_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get pricing rule for this match
    const { data: rule } = await supabase.from("match_pricing_rules").select("*").eq("match_id", match_id).single();

    const baseNew = rule?.base_price_new ?? 500;
    const baseReturning = rule?.base_price_returning ?? baseNew;
    const loyaltyFromMatchId = rule?.loyalty_from_match_id;

    // Check returning status and past seat count for loyalty pricing
    let loyaltySeatCap = 0; // how many seats get the returning rate

    if (loyaltyFromMatchId) {
      // Loyalty pricing: returning rate applies up to the number of seats from the linked match
      const { data: pastOrders } = await supabase
        .from("orders")
        .select("seats_count")
        .eq("purchaser_mobile", mobile)
        .eq("match_id", loyaltyFromMatchId)
        .in("payment_status", ["paid_verified", "paid_manual_verified"]);

      if (pastOrders && pastOrders.length > 0) {
        loyaltySeatCap = pastOrders.reduce((sum: number, o: any) => sum + (o.seats_count || 0), 0);
      }
    } else {
      // Standard returning: check any past verified order for any other match
      const { data: pastOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("purchaser_mobile", mobile)
        .in("payment_status", ["paid_verified", "paid_manual_verified"])
        .neq("match_id", match_id);

      if (pastOrders && pastOrders.length > 0) {
        loyaltySeatCap = seats_count; // all seats at returning rate for standard returning
      }
    }

    const isReturning = loyaltySeatCap > 0;
    const seats: Array<{ seat_index: number; price: number; reason: string }> = [];

    for (let i = 0; i < seats_count; i++) {
      let price: number;
      let reason: string;

      if (isReturning && i < loyaltySeatCap) {
        price = baseReturning;
        reason = "loyal_base";
      } else {
        price = baseNew;
        reason = isReturning ? "extra_seat" : "new_customer";
      }
      seats.push({ seat_index: i, price, reason });
    }

    const total = seats.reduce((sum, s) => sum + s.price, 0);
    return new Response(
      JSON.stringify({ seats, total, seating_type, is_returning: isReturning, loyalty_seat_cap: loyaltySeatCap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
