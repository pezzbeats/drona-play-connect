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
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { window_id, correct_answer, action, match_id, question, options } = body;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Helper: fetch scoring config (with defaults) ──────────────────────────
    const fetchScoringConfig = async (mId: string) => {
      const { data } = await supabase
        .from("match_scoring_config")
        .select("*")
        .eq("match_id", mId)
        .maybeSingle();
      return {
        points_per_correct: 10,
        points_per_over_correct: 25,
        speed_bonus_enabled: false,
        speed_bonus_points: 5,
        speed_bonus_first_n: 10,
        tiebreaker_mode: "accuracy",
        leaderboard_frozen: false,
        ...data,
      };
    };

    // ── Helper: recompute rank_position for all entries in a match ────────────
    const recomputeRanks = async (mId: string) => {
      const { data: rows } = await supabase
        .from("leaderboard")
        .select("id, total_points, points_adjustment, tiebreaker_score, last_updated")
        .eq("match_id", mId);
      if (!rows || rows.length === 0) return;

      const sorted = [...rows].sort((a, b) => {
        const aTotal = (a.total_points || 0) + (a.points_adjustment || 0);
        const bTotal = (b.total_points || 0) + (b.points_adjustment || 0);
        if (bTotal !== aTotal) return bTotal - aTotal;
        const aTb = a.tiebreaker_score || 0;
        const bTb = b.tiebreaker_score || 0;
        if (bTb !== aTb) return bTb - aTb;
        // earlier last_updated wins (faster player)
        return new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
      });

      for (let i = 0; i < sorted.length; i++) {
        await supabase
          .from("leaderboard")
          .update({ rank_position: i + 1 })
          .eq("id", sorted[i].id);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    if (action === "lock") {
      const { data, error } = await supabase
        .from("prediction_windows")
        .update({ status: "locked" })
        .eq("id", window_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, window: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    if (action === "resolve") {
      // Check windows_locked flag
      if (match_id) {
        const { data: flags } = await supabase
          .from("match_flags")
          .select("windows_locked")
          .eq("match_id", match_id)
          .maybeSingle();
        if (flags?.windows_locked) {
          return new Response(
            JSON.stringify({ error: "Windows are locked by panic control. Unfreeze first." }),
            { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Set correct answer and resolve window
      const { data: window, error: windowError } = await supabase
        .from("prediction_windows")
        .update({ status: "resolved", correct_answer: correct_answer })
        .eq("id", window_id)
        .select()
        .single();
      if (windowError) throw windowError;

      // Fetch scoring config for this match
      const config = await fetchScoringConfig(window.match_id);
      const isOverWindow = window.window_type === "over";
      const basePoints = isOverWindow ? config.points_per_over_correct : config.points_per_correct;

      // Get all predictions for this window
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")
        .eq("window_id", window_id);

      let leaderboardUpdated = false;
      const leaderboardFrozen = config.leaderboard_frozen;

      if (predictions && predictions.length > 0) {
        const correctAnswerKey = JSON.stringify(correct_answer);

        // Count correct predictions so far (for speed bonus ordering)
        let correctSoFar = 0;

        for (const pred of predictions) {
          const isCorrect = JSON.stringify(pred.prediction) === correctAnswerKey;

          // Speed bonus: first N correct answers get extra points
          let speedBonus = 0;
          if (isCorrect && config.speed_bonus_enabled) {
            if (correctSoFar < config.speed_bonus_first_n) {
              speedBonus = config.speed_bonus_points;
            }
            correctSoFar++;
          }

          const pointsEarned = isCorrect ? basePoints + speedBonus : 0;

          // Update prediction row
          await supabase
            .from("predictions")
            .update({ is_correct: isCorrect, points_earned: pointsEarned })
            .eq("id", pred.id);

          // Skip leaderboard writes if frozen
          if (leaderboardFrozen) continue;

          // Update leaderboard
          const { data: existing } = await supabase
            .from("leaderboard")
            .select("*")
            .eq("match_id", window.match_id)
            .eq("mobile", pred.mobile)
            .maybeSingle();

          const now = new Date().toISOString();
          const newCorrect = (existing?.correct_predictions || 0) + (isCorrect ? 1 : 0);
          const newTotal = (existing?.total_predictions || 0) + 1;
          const newPoints = (existing?.total_points || 0) + pointsEarned;
          const newLastCorrect = isCorrect ? now : (existing?.last_correct_at ?? null);

          // Tiebreaker score computation
          let tiebreakerScore: number;
          if (config.tiebreaker_mode === "time") {
            // Lower epoch = faster = better (store as negative so DESC ordering works)
            tiebreakerScore = isCorrect
              ? -(new Date(now).getTime())
              : (existing?.tiebreaker_score ?? 0);
          } else {
            // accuracy mode: ratio 0-1
            tiebreakerScore = newTotal > 0 ? newCorrect / newTotal : 0;
          }

          if (existing) {
            await supabase
              .from("leaderboard")
              .update({
                total_points: newPoints,
                correct_predictions: newCorrect,
                total_predictions: newTotal,
                tiebreaker_score: tiebreakerScore,
                last_correct_at: newLastCorrect,
                last_updated: now,
              })
              .eq("id", existing.id);
          } else {
            await supabase
              .from("leaderboard")
              .insert({
                match_id: window.match_id,
                mobile: pred.mobile,
                player_name: pred.player_name,
                total_points: pointsEarned,
                correct_predictions: isCorrect ? 1 : 0,
                total_predictions: 1,
                tiebreaker_score: tiebreakerScore,
                last_correct_at: isCorrect ? now : null,
                last_updated: now,
              });
          }
          leaderboardUpdated = true;
        }

        // Recompute rank_position after all updates
        if (leaderboardUpdated) {
          await recomputeRanks(window.match_id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          resolved: predictions?.length || 0,
          leaderboard_frozen: leaderboardFrozen,
          base_points: basePoints,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    if (action === "open") {
      if (match_id) {
        const { data: flags } = await supabase
          .from("match_flags")
          .select("windows_locked, predictions_frozen")
          .eq("match_id", match_id)
          .maybeSingle();
        if (flags?.windows_locked || flags?.predictions_frozen) {
          return new Response(
            JSON.stringify({ error: "Predictions are frozen by panic control. Unfreeze first." }),
            { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Race condition guard: reject if a window is already open
      const { data: existingOpen } = await supabase
        .from("prediction_windows")
        .select("id, question")
        .eq("match_id", match_id)
        .eq("status", "open")
        .maybeSingle();

      if (existingOpen) {
        return new Response(
          JSON.stringify({ error: "A prediction window is already open. Lock it before opening a new one." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const nowOpen = new Date();
      const locksAtOpen = new Date(nowOpen.getTime() + 12_000); // 12 seconds auto-lock
      const { data, error } = await supabase
        .from("prediction_windows")
        .insert({
          match_id,
          window_type: body.window_type || "ball",
          question: question || "What will happen on the next ball?",
          options: options || [
            { key: "dot", label: "Dot Ball" },
            { key: "1", label: "1 Run" },
            { key: "2", label: "2 Runs" },
            { key: "4", label: "4 Boundary" },
            { key: "6", label: "6 Sixer" },
            { key: "wicket", label: "Wicket 🏏" },
          ],
          status: "open",
          opens_at: nowOpen.toISOString(),
          locks_at: locksAtOpen.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, window: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
