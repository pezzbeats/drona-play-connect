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
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminId = userData.user.id;
    const body = await req.json();
    const { action, match_id } = body;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const ok = (data: any) =>
      new Response(JSON.stringify({ success: true, ...data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const err = (msg: string, status = 400) =>
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const logActivity = async (actAction: string, meta?: any) => {
      await supabase.from("admin_activity").insert({
        admin_id: adminId,
        action: actAction,
        entity_type: "super_over",
        entity_id: match_id,
        meta,
      });
    };

    // ── Fetch live state ─────────────────────────────────────────────────────
    const { data: liveState } = await supabase
      .from("match_live_state")
      .select("*")
      .eq("match_id", match_id)
      .single();

    if (!liveState) return err("Live state not found for this match", 404);

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: activate
    // ════════════════════════════════════════════════════════════════════════
    if (action === "activate") {
      if (liveState.super_over_active) return err("Super Over is already active");
      if (liveState.innings1_score !== liveState.innings2_score) {
        return err(`Scores are not tied: ${liveState.innings1_score} vs ${liveState.innings2_score}`);
      }

      // Get roster teams
      const { data: roster } = await supabase
        .from("match_roster")
        .select("team_id, is_batting_first")
        .eq("match_id", match_id);

      const teamA = roster?.find((r: any) => r.is_batting_first)?.team_id || roster?.[0]?.team_id;
      const teamB = roster?.find((r: any) => !r.is_batting_first)?.team_id || roster?.[1]?.team_id;

      // Create round 1
      const { data: round, error: roundErr } = await supabase
        .from("super_over_rounds")
        .insert({
          match_id,
          round_number: 1,
          innings_a_no: 3,
          innings_b_no: 4,
          team_a_id: teamA,
          team_b_id: teamB,
          status: "pending",
          activated_by_admin_id: adminId,
        })
        .select()
        .single();
      if (roundErr) throw roundErr;

      // Lock any open prediction windows
      await supabase
        .from("prediction_windows")
        .update({ status: "locked" })
        .eq("match_id", match_id)
        .eq("status", "open");

      // Update live state
      const { error: stateErr } = await supabase
        .from("match_live_state")
        .update({
          super_over_active: true,
          super_over_round: 1,
          super_over_innings: 0,
          super_over_score: 0,
          super_over_wickets: 0,
          super_over_overs: 0,
          phase: "super_over",
          current_striker_id: null,
          current_non_striker_id: null,
          current_bowler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", match_id);
      if (stateErr) throw stateErr;

      await supabase.from("matches").update({ status: "live" }).eq("id", match_id);
      await logActivity("super_over_activated", { round_number: 1, tied_score: liveState.innings1_score });

      return ok({ round });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: start_innings
    // ════════════════════════════════════════════════════════════════════════
    if (action === "start_innings") {
      const { innings_type, batting_team_id, bowling_team_id } = body;
      if (!["a", "b"].includes(innings_type)) return err("innings_type must be 'a' or 'b'");

      // Get current round
      const { data: round } = await supabase
        .from("super_over_rounds")
        .select("*")
        .eq("match_id", match_id)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();
      if (!round) return err("No super over round found");

      const newStatus = innings_type === "a" ? "innings_a" : "innings_b";
      const inningsNo = innings_type === "a" ? round.innings_a_no : round.innings_b_no;

      await supabase
        .from("super_over_rounds")
        .update({ status: newStatus })
        .eq("id", round.id);

      await supabase
        .from("match_live_state")
        .update({
          super_over_innings: inningsNo,
          super_over_score: 0,
          super_over_wickets: 0,
          super_over_overs: 0,
          batting_team_id: batting_team_id || null,
          bowling_team_id: bowling_team_id || null,
          current_striker_id: null,
          current_non_striker_id: null,
          current_bowler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", match_id);

      await logActivity("super_over_innings_started", { innings_type, round_number: round.round_number, innings_no: inningsNo });
      return ok({ innings_no: inningsNo, round_number: round.round_number });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: complete_innings
    // ════════════════════════════════════════════════════════════════════════
    if (action === "complete_innings") {
      const { innings_type } = body;
      if (!["a", "b"].includes(innings_type)) return err("innings_type must be 'a' or 'b'");

      const { data: round } = await supabase
        .from("super_over_rounds")
        .select("*")
        .eq("match_id", match_id)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();
      if (!round) return err("No super over round found");

      const inningsNo = innings_type === "a" ? round.innings_a_no : round.innings_b_no;

      // Re-sum deliveries server-side
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("runs_off_bat, extras_runs, is_wicket")
        .eq("match_id", match_id)
        .eq("innings_no", inningsNo);

      const score = (deliveries || []).reduce((s: number, d: any) => s + (d.runs_off_bat || 0) + (d.extras_runs || 0), 0);
      const wickets = (deliveries || []).filter((d: any) => d.is_wicket).length;

      // Save to round
      const updateData: any = {};
      if (innings_type === "a") {
        updateData.team_a_score = score;
        updateData.team_a_wickets = wickets;
      } else {
        updateData.team_b_score = score;
        updateData.team_b_wickets = wickets;
      }

      // Check if both innings are done
      const otherInningsNo = innings_type === "a" ? round.innings_b_no : round.innings_a_no;
      const { data: otherDeliveries } = await supabase
        .from("deliveries")
        .select("id")
        .eq("match_id", match_id)
        .eq("innings_no", otherInningsNo)
        .limit(1);

      const otherInningsHasData = (otherDeliveries || []).length > 0;
      let evaluatedRound: any = null;

      if (innings_type === "b") {
        // Both innings done — evaluate winner
        const teamAScore = innings_type === "a" ? score : round.team_a_score;
        const teamBScore = innings_type === "b" ? score : round.team_b_score;

        if (teamAScore === teamBScore) {
          updateData.is_tied = true;
          updateData.winner_team_id = null;
        } else {
          updateData.winner_team_id = teamAScore > teamBScore ? round.team_a_id : round.team_b_id;
          updateData.is_tied = false;
        }
        updateData.status = "complete";
        updateData.completed_at = new Date().toISOString();
      } else if (innings_type === "a" && otherInningsHasData) {
        // Innings A completed after B already had data (shouldn't normally happen but handle)
        const teamBScore = round.team_b_score;
        if (score === teamBScore) {
          updateData.is_tied = true;
          updateData.winner_team_id = null;
        } else {
          updateData.winner_team_id = score > teamBScore ? round.team_a_id : round.team_b_id;
          updateData.is_tied = false;
        }
        updateData.status = "complete";
        updateData.completed_at = new Date().toISOString();
      } else {
        // Innings A done, B pending
        updateData.status = innings_type === "a" ? "innings_b" : "complete";
      }

      const { data: updatedRound } = await supabase
        .from("super_over_rounds")
        .update(updateData)
        .eq("id", round.id)
        .select()
        .single();

      evaluatedRound = updatedRound;

      await logActivity("super_over_innings_completed", {
        innings_type, innings_no: inningsNo, score, wickets, round_number: round.round_number,
      });

      return ok({ round: evaluatedRound, score, wickets });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: add_round
    // ════════════════════════════════════════════════════════════════════════
    if (action === "add_round") {
      const { data: lastRound } = await supabase
        .from("super_over_rounds")
        .select("*")
        .eq("match_id", match_id)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      if (!lastRound) return err("No existing rounds found");
      if (!lastRound.is_tied) return err("Last round was not tied — cannot add another round");
      if (lastRound.status !== "complete") return err("Last round is not complete yet");

      const newRoundNumber = lastRound.round_number + 1;
      const newInningsANo = lastRound.innings_b_no + 1;
      const newInningsBNo = lastRound.innings_b_no + 2;

      const { data: newRound, error: newRoundErr } = await supabase
        .from("super_over_rounds")
        .insert({
          match_id,
          round_number: newRoundNumber,
          innings_a_no: newInningsANo,
          innings_b_no: newInningsBNo,
          team_a_id: lastRound.team_a_id,
          team_b_id: lastRound.team_b_id,
          status: "pending",
          activated_by_admin_id: adminId,
        })
        .select()
        .single();
      if (newRoundErr) throw newRoundErr;

      // Reset super over live score
      await supabase
        .from("match_live_state")
        .update({
          super_over_round: newRoundNumber,
          super_over_innings: 0,
          super_over_score: 0,
          super_over_wickets: 0,
          super_over_overs: 0,
          current_striker_id: null,
          current_non_striker_id: null,
          current_bowler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", match_id);

      await logActivity("super_over_round_added", { round_number: newRoundNumber });
      return ok({ round: newRound });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: finalize
    // ════════════════════════════════════════════════════════════════════════
    if (action === "finalize") {
      // Guard: no active innings
      const { data: activeRounds } = await supabase
        .from("super_over_rounds")
        .select("id, status")
        .eq("match_id", match_id)
        .in("status", ["innings_a", "innings_b"]);

      if ((activeRounds || []).length > 0) {
        return err("Cannot finalize: there is an active super over innings in progress");
      }

      // Get latest round for winner info
      const { data: latestRound } = await supabase
        .from("super_over_rounds")
        .select("*")
        .eq("match_id", match_id)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      await supabase
        .from("match_live_state")
        .update({
          phase: "ended",
          super_over_active: false,
          current_striker_id: null,
          current_non_striker_id: null,
          current_bowler_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", match_id);

      await supabase.from("matches").update({ status: "ended" }).eq("id", match_id);

      // Lock all open prediction windows
      await supabase
        .from("prediction_windows")
        .update({ status: "locked" })
        .eq("match_id", match_id)
        .eq("status", "open");

      await logActivity("super_over_finalized", {
        final_round: latestRound?.round_number,
        winner_team_id: latestRound?.winner_team_id,
        is_tied: latestRound?.is_tied,
      });

      return ok({ finalized: true, latest_round: latestRound });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
