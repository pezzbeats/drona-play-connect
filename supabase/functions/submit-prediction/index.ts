import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, pin, window_id, prediction } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validate game access session
    const pinHash = await hashPin(pin);
    const { data: access } = await supabase
      .from("game_access")
      .select("*, match_id")
      .eq("mobile", mobile)
      .eq("pin_hash", pinHash)
      .eq("is_active", true)
      .single();

    if (!access) {
      return new Response(JSON.stringify({ error: "Invalid game session. Please check in and get your PIN." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate prediction window
    const { data: window } = await supabase
      .from("prediction_windows")
      .select("*")
      .eq("id", window_id)
      .single();

    if (!window) {
      return new Response(JSON.stringify({ error: "Prediction window not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (window.status !== "open") {
      return new Response(JSON.stringify({ error: "Prediction window is closed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get player name from game_access/orders
    const { data: orderData } = await supabase
      .from("orders")
      .select("purchaser_full_name")
      .eq("purchaser_mobile", mobile)
      .eq("match_id", access.match_id)
      .limit(1)
      .single();

    const playerName = orderData?.purchaser_full_name || mobile;

    // Upsert prediction
    const { data: pred, error: predError } = await supabase
      .from("predictions")
      .upsert({
        window_id,
        match_id: window.match_id,
        mobile,
        player_name: playerName,
        prediction,
        is_correct: null,
        points_earned: 0,
      }, { onConflict: "window_id,mobile" })
      .select()
      .single();

    if (predError) throw predError;

    // Update leaderboard total_predictions
    await supabase
      .from("leaderboard")
      .upsert({
        match_id: window.match_id,
        mobile,
        player_name: playerName,
        total_predictions: 1,
        last_updated: new Date().toISOString(),
      }, { onConflict: "match_id,mobile" });

    return new Response(JSON.stringify({ success: true, prediction: pred }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
