import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      match_id, over_id, innings_no, over_no,
      bowler_id, striker_id, non_striker_id,
      runs_off_bat, extras_type, extras_runs,
      is_wicket, wicket_type, out_player_id, fielder_id,
      free_hit, notes,
    } = body;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get current delivery count for this over
    const { data: existingDeliveries } = await supabase
      .from("deliveries")
      .select("ball_no, delivery_no, extras_type")
      .eq("over_id", over_id)
      .order("delivery_no", { ascending: false });

    const lastDeliveryNo = existingDeliveries && existingDeliveries.length > 0
      ? existingDeliveries[0].delivery_no
      : 0;

    // Illegal delivery = wide or no_ball → ball_no doesn't increment
    const isIllegal = extras_type === "wide" || extras_type === "no_ball";
    const legalBallCount = existingDeliveries
      ? existingDeliveries.filter(d => d.extras_type !== "wide" && d.extras_type !== "no_ball").length
      : 0;

    const ballNo = isIllegal ? legalBallCount + 1 : legalBallCount + 1;
    const deliveryNo = lastDeliveryNo + 1;

    // Insert delivery
    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .insert({
        match_id, over_id, innings_no: innings_no || 1, over_no,
        ball_no: ballNo,
        delivery_no: deliveryNo,
        bowler_id: bowler_id || null,
        striker_id: striker_id || null,
        non_striker_id: non_striker_id || null,
        runs_off_bat: runs_off_bat || 0,
        extras_type: extras_type || "none",
        extras_runs: extras_runs || 0,
        is_wicket: is_wicket || false,
        wicket_type: wicket_type || null,
        out_player_id: out_player_id || null,
        fielder_id: fielder_id || null,
        free_hit: free_hit || false,
        notes: notes || null,
      })
      .select()
      .single();

    if (deliveryError) throw deliveryError;

    // Update live state
    const { data: liveState } = await supabase
      .from("match_live_state")
      .select("*")
      .eq("match_id", match_id)
      .single();

    if (liveState) {
      const inningsKey = (innings_no || 1) === 1 ? "innings1" : "innings2";
      const totalRuns = (runs_off_bat || 0) + (extras_runs || 0);
      const newScore = (liveState[`${inningsKey}_score`] || 0) + totalRuns;
      const newWickets = (liveState[`${inningsKey}_wickets`] || 0) + (is_wicket ? 1 : 0);

      // Calculate overs: legal balls in current over
      const newLegalBalls = isIllegal ? legalBallCount : legalBallCount + 1;
      const completedOvers = Math.floor(newLegalBalls / 6);
      const remainingBalls = newLegalBalls % 6;

      // Get total overs across all previous overs
      const { data: allOvers } = await supabase
        .from("over_control")
        .select("id")
        .eq("match_id", match_id)
        .eq("innings_no", innings_no || 1)
        .eq("status", "complete");

      const completedOversCount = (allOvers?.length || 0);
      const oversDisplay = completedOversCount + (remainingBalls > 0 ? remainingBalls / 10 : 0);

      // Summary string
      let summaryParts = [];
      if (extras_type === "wide") summaryParts.push("WD");
      else if (extras_type === "no_ball") summaryParts.push("NB");
      else if (extras_type === "bye") summaryParts.push(`${extras_runs}b`);
      else if (extras_type === "leg_bye") summaryParts.push(`${extras_runs}lb`);
      if (runs_off_bat > 0) summaryParts.push(`${runs_off_bat} runs`);
      if (is_wicket) summaryParts.push("WICKET! 🏏");
      const summary = summaryParts.length > 0 ? summaryParts.join(" + ") : "Dot ball";

      const updateData: any = {
        [`${inningsKey}_score`]: newScore,
        [`${inningsKey}_wickets`]: newWickets,
        [`${inningsKey}_overs`]: oversDisplay,
        last_delivery_summary: summary,
        updated_at: new Date().toISOString(),
      };

      // Update current batsmen if wicket
      if (is_wicket && out_player_id) {
        if (liveState.current_striker_id === out_player_id) {
          updateData.current_striker_id = null;
        } else if (liveState.current_non_striker_id === out_player_id) {
          updateData.current_non_striker_id = null;
        }
      }

      await supabase
        .from("match_live_state")
        .update(updateData)
        .eq("match_id", match_id);
    }

    // If over is now complete (6 legal balls), mark it complete
    const newLegalBallsTotal = isIllegal ? legalBallCount : legalBallCount + 1;
    if (newLegalBallsTotal >= 6) {
      await supabase
        .from("over_control")
        .update({ status: "complete" })
        .eq("id", over_id);
    }

    return new Response(JSON.stringify({ success: true, delivery }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
