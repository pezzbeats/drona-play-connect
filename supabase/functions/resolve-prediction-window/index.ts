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

    // Parse body ONCE at the top
    const body = await req.json();
    const { window_id, correct_answer, action, match_id, question, options } = body;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "lock") {
      // Just lock the window (stop accepting predictions)
      const { data, error } = await supabase
        .from("prediction_windows")
        .update({ status: "locked" })
        .eq("id", window_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, window: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

      // Set correct answer and resolve all predictions
      const { data: window, error: windowError } = await supabase
        .from("prediction_windows")
        .update({ status: "resolved", correct_answer: correct_answer })
        .eq("id", window_id)
        .select()
        .single();
      if (windowError) throw windowError;

      // Get all predictions for this window
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")
        .eq("window_id", window_id);

      if (predictions && predictions.length > 0) {
        const correctAnswerKey = JSON.stringify(correct_answer);
        const pointsPerCorrect = 10;

        for (const pred of predictions) {
          const isCorrect = JSON.stringify(pred.prediction) === correctAnswerKey;
          const pointsEarned = isCorrect ? pointsPerCorrect : 0;

          // Update prediction
          await supabase
            .from("predictions")
            .update({ is_correct: isCorrect, points_earned: pointsEarned })
            .eq("id", pred.id);

          // Update leaderboard
          const { data: existing } = await supabase
            .from("leaderboard")
            .select("*")
            .eq("match_id", window.match_id)
            .eq("mobile", pred.mobile)
            .single();

          if (existing) {
            await supabase
              .from("leaderboard")
              .update({
                total_points: (existing.total_points || 0) + pointsEarned,
                correct_predictions: (existing.correct_predictions || 0) + (isCorrect ? 1 : 0),
                total_predictions: (existing.total_predictions || 0) + 1,
                last_updated: new Date().toISOString(),
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
                last_updated: new Date().toISOString(),
              });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, resolved: predictions?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "open") {
      // Check windows_locked flag
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

      // ── Race condition guard: reject if a window is already open ──
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

      const { data, error } = await supabase
        .from("prediction_windows")
        .insert({
          match_id,
          window_type: "ball",
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
          opens_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, window: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
