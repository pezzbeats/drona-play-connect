import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(level: string, message: string, ctx: Record<string, unknown> = {}) {
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...ctx })
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const matchId = body.match_id;
    if (!matchId) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("info", "Starting overall leaderboard update", { match_id: matchId });

    // 1. Fetch all leaderboard entries for this match
    const { data: matchEntries, error: fetchErr } = await sb
      .from("leaderboard")
      .select("mobile, player_name, total_points, points_adjustment, correct_predictions, total_predictions, rank_position")
      .eq("match_id", matchId);

    if (fetchErr) throw fetchErr;
    if (!matchEntries || matchEntries.length === 0) {
      log("info", "No leaderboard entries for match", { match_id: matchId });
      return new Response(JSON.stringify({ success: true, players: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. For each player, insert into leaderboard_match_history (upsert)
    for (const entry of matchEntries) {
      const totalPts = (entry.total_points || 0) + (entry.points_adjustment || 0);
      const acc = entry.total_predictions > 0
        ? (entry.correct_predictions / entry.total_predictions) * 100
        : 0;

      await sb.from("leaderboard_match_history").upsert(
        {
          match_id: matchId,
          mobile: entry.mobile,
          player_name: entry.player_name,
          final_rank: entry.rank_position,
          final_points: totalPts,
          correct_predictions: entry.correct_predictions || 0,
          total_predictions: entry.total_predictions || 0,
          accuracy_percentage: Math.round(acc * 100) / 100,
          participated_at: new Date().toISOString(),
        },
        { onConflict: "match_id,mobile" }
      );
    }

    // 3. For each unique player, aggregate all history and upsert into leaderboard_overall
    const uniqueMobiles = [...new Set(matchEntries.map(e => e.mobile))];

    for (const mobile of uniqueMobiles) {
      const { data: history } = await sb
        .from("leaderboard_match_history")
        .select("final_rank, final_points, correct_predictions, total_predictions, player_name")
        .eq("mobile", mobile);

      if (!history || history.length === 0) continue;

      const totalPointsOverall = history.reduce((s, h) => s + (h.final_points || 0), 0);
      const correctOverall = history.reduce((s, h) => s + (h.correct_predictions || 0), 0);
      const totalPredOverall = history.reduce((s, h) => s + (h.total_predictions || 0), 0);
      const matchesParticipated = history.length;
      const matchesWon = history.filter(h => h.final_rank === 1).length;
      const bestRank = Math.min(...history.map(h => h.final_rank || 9999));
      const playerName = history[history.length - 1].player_name;

      await sb.from("leaderboard_overall").upsert(
        {
          mobile,
          player_name: playerName,
          total_points_overall: totalPointsOverall,
          correct_predictions_overall: correctOverall,
          total_predictions_overall: totalPredOverall,
          matches_participated: matchesParticipated,
          matches_won: matchesWon,
          best_match_rank: bestRank === 9999 ? null : bestRank,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "mobile" }
      );
    }

    // 4. Recompute rank_position_overall for ALL players
    const { data: allOverall } = await sb
      .from("leaderboard_overall")
      .select("id, total_points_overall, correct_predictions_overall")
      .order("total_points_overall", { ascending: false })
      .order("correct_predictions_overall", { ascending: false });

    if (allOverall) {
      for (let i = 0; i < allOverall.length; i++) {
        await sb.from("leaderboard_overall")
          .update({ rank_position_overall: i + 1 })
          .eq("id", allOverall[i].id);
      }
    }

    log("info", "Overall leaderboard updated", {
      match_id: matchId,
      players: uniqueMobiles.length,
      total_ranked: allOverall?.length || 0,
    });

    return new Response(
      JSON.stringify({ success: true, players: uniqueMobiles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    log("error", "update-overall-leaderboard error", { error: e.message });
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
