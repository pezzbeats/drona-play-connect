import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRICKET_API_BASE = "https://api.cricapi.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const CRICKET_API_KEY = Deno.env.get("CRICKET_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!CRICKET_API_KEY) {
    return new Response(
      JSON.stringify({ error: "CRICKET_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "discover";

  try {
    if (action === "discover") {
      return await handleDiscover(sb, CRICKET_API_KEY);
    } else if (action === "sync") {
      return await handleSync(sb, CRICKET_API_KEY);
    } else if (action === "status") {
      return await handleStatus(sb);
    }
    return json({ error: "Invalid action" }, 400);
  } catch (e: any) {
    console.error("cricket-api-sync error:", e);
    return json({ error: e.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── DISCOVER ─────────────────────────────────────────────────────────
async function handleDiscover(sb: any, apiKey: string) {
  const res = await fetch(
    `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`
  );
  const body = await res.json();
  if (body.status !== "success") return json({ error: "API error", detail: body }, 502);

  // Get active event
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const eventId = event?.id;
  if (!eventId) return json({ error: "No active event found" }, 400);

  const matches = (body.data || []).filter(
    (m: any) =>
      m.matchType === "t20" &&
      (m.series?.toLowerCase().includes("ipl") ||
        m.name?.toLowerCase().includes("ipl"))
  );

  const created: string[] = [];
  const skipped: string[] = [];

  for (const m of matches) {
    const extId = m.id;
    // Check if already imported
    const { data: existing } = await sb
      .from("matches")
      .select("id")
      .eq("external_match_id", extId)
      .maybeSingle();

    if (existing) {
      skipped.push(extId);
      continue;
    }

    // Extract team names
    const teamNames: string[] = (m.teams || []).slice(0, 2);
    const teamIds: string[] = [];

    for (const tName of teamNames) {
      const shortCode = tName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 3);

      // Upsert team
      const { data: existingTeam } = await sb
        .from("teams")
        .select("id")
        .eq("name", tName)
        .maybeSingle();

      if (existingTeam) {
        teamIds.push(existingTeam.id);
      } else {
        const { data: newTeam } = await sb
          .from("teams")
          .insert({ name: tName, short_code: shortCode })
          .select("id")
          .single();
        if (newTeam) teamIds.push(newTeam.id);
      }
    }

    // Create match
    const matchName = m.name || `${teamNames[0]} vs ${teamNames[1]}`;
    const opponent = teamNames.length > 1 ? teamNames[1] : null;
    const startTime = m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString() : null;

    // Map API status to our status enum
    let status: string = "draft";
    if (m.matchStarted && !m.matchEnded) status = "live";
    else if (m.matchEnded) status = "ended";
    else if (startTime) status = "registrations_open";

    const { data: newMatch, error: matchErr } = await sb
      .from("matches")
      .insert({
        event_id: eventId,
        name: matchName,
        opponent,
        match_type: "group",
        venue: m.venue || "",
        start_time: startTime,
        status,
        external_match_id: extId,
        predictions_enabled: true,
        prediction_mode: "per_ball",
      })
      .select("id")
      .single();

    if (matchErr) {
      console.error("Failed to create match:", matchErr);
      continue;
    }

    const matchId = newMatch.id;

    // Create roster
    if (teamIds.length >= 2) {
      await sb.from("match_roster").insert([
        { match_id: matchId, team_id: teamIds[0], side: "home", is_batting_first: false },
        { match_id: matchId, team_id: teamIds[1], side: "away", is_batting_first: false },
      ]);
    }

    // Create match_live_state
    await sb.from("match_live_state").insert({
      match_id: matchId,
      phase: status === "live" ? "innings1" : "pre",
      batting_team_id: teamIds[0] || null,
      bowling_team_id: teamIds[1] || null,
    });

    // Create scoring config
    await sb.from("match_scoring_config").insert({ match_id: matchId });

    // Create match_flags
    await sb.from("match_flags").insert({ match_id: matchId });

    // Create sync state
    await sb.from("api_sync_state").insert({
      match_id: matchId,
      external_match_id: extId,
    });

    created.push(extId);
  }

  return json({
    discovered: matches.length,
    created: created.length,
    skipped: skipped.length,
    created_ids: created,
    skipped_ids: skipped,
  });
}

// ── SYNC ─────────────────────────────────────────────────────────────
async function handleSync(sb: any, apiKey: string) {
  // Get all matches with sync enabled and live status
  const { data: syncStates } = await sb
    .from("api_sync_state")
    .select("*, matches!inner(id, status, external_match_id)")
    .eq("sync_enabled", true);

  if (!syncStates || syncStates.length === 0)
    return json({ synced: 0, message: "No matches to sync" });

  const results: any[] = [];

  for (const state of syncStates) {
    const matchId = state.match_id;
    const extId = state.external_match_id;
    const matchStatus = state.matches?.status;

    // Only sync live matches
    if (matchStatus !== "live") {
      results.push({ match_id: matchId, status: "skipped", reason: "not live" });
      continue;
    }

    try {
      // Fetch scorecard from API
      const res = await fetch(
        `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&id=${extId}`
      );
      const body = await res.json();

      if (body.status !== "success") {
        // Try currentMatches as fallback
        const fallbackRes = await fetch(
          `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`
        );
        const fallbackBody = await fallbackRes.json();
        const matchData = (fallbackBody.data || []).find((m: any) => m.id === extId);

        if (!matchData) {
          results.push({ match_id: matchId, status: "error", reason: "not found in API" });
          continue;
        }

        // Use basic score data from currentMatches
        await syncFromBasicData(sb, matchId, state, matchData);
        results.push({ match_id: matchId, status: "synced_basic" });
        continue;
      }

      // Full scorecard sync
      await syncFromScorecard(sb, matchId, state, body.data);
      results.push({ match_id: matchId, status: "synced_full" });
    } catch (e: any) {
      console.error(`Sync error for ${matchId}:`, e);
      results.push({ match_id: matchId, status: "error", reason: e.message });
    }
  }

  return json({ synced: results.length, results });
}

// Sync using basic currentMatches data (score array)
async function syncFromBasicData(sb: any, matchId: string, state: any, matchData: any) {
  const scores = matchData.score || [];
  let inn1Score = state.last_innings1_score;
  let inn1Wickets = state.last_innings1_wickets;
  let inn1Overs = Number(state.last_innings1_overs);
  let inn2Score = state.last_innings2_score;
  let inn2Wickets = state.last_innings2_wickets;
  let inn2Overs = Number(state.last_innings2_overs);

  // Parse scores - API returns array like [{r: 180, w: 5, o: 20, inning: "Team A Inning 1"}, ...]
  for (const s of scores) {
    const inningStr = (s.inning || "").toLowerCase();
    if (inningStr.includes("1st") || inningStr.includes("inning 1") || scores.indexOf(s) === 0) {
      inn1Score = s.r || 0;
      inn1Wickets = s.w || 0;
      inn1Overs = s.o || 0;
    } else {
      inn2Score = s.r || 0;
      inn2Wickets = s.w || 0;
      inn2Overs = s.o || 0;
    }
  }

  // Detect score changes and derive deliveries
  const currentInnings = inn2Overs > 0 || inn2Score > 0 ? 2 : 1;
  const prevScore = currentInnings === 1 ? state.last_innings1_score : state.last_innings2_score;
  const prevWickets = currentInnings === 1 ? state.last_innings1_wickets : state.last_innings2_wickets;
  const prevOvers = currentInnings === 1 ? Number(state.last_innings1_overs) : Number(state.last_innings2_overs);
  const newScore = currentInnings === 1 ? inn1Score : inn2Score;
  const newWickets = currentInnings === 1 ? inn1Wickets : inn2Wickets;
  const newOvers = currentInnings === 1 ? inn1Overs : inn2Overs;

  if (newScore !== prevScore || newWickets !== prevWickets || newOvers !== prevOvers) {
    // Score changed - derive what happened
    const runsDelta = newScore - prevScore;
    const wicketsDelta = newWickets - prevWickets;
    const oversDelta = newOvers - prevOvers;

    // Determine the current over number from overs (e.g. 6.3 means over 7, ball 3)
    const overNo = Math.floor(newOvers) + 1;
    const ballInOver = Math.round((newOvers % 1) * 10);

    // Get or create over_control
    let { data: overCtrl } = await sb
      .from("over_control")
      .select("id")
      .eq("match_id", matchId)
      .eq("innings_no", currentInnings)
      .eq("over_no", overNo)
      .maybeSingle();

    if (!overCtrl) {
      const { data: newOver } = await sb
        .from("over_control")
        .insert({
          match_id: matchId,
          over_no: overNo,
          innings_no: currentInnings,
          status: "active",
        })
        .select("id")
        .single();
      overCtrl = newOver;
    }

    if (overCtrl) {
      // Derive delivery outcome
      let runsOffBat = runsDelta;
      let extrasType = "none";
      let extrasRuns = 0;
      let isWicket = wicketsDelta > 0;

      // If overs didn't advance but score changed, might be a wide/no-ball
      if (oversDelta === 0 && runsDelta > 0 && !isWicket) {
        // Could be wide or no-ball
        extrasType = "wide";
        extrasRuns = 1;
        runsOffBat = Math.max(0, runsDelta - 1);
      }

      // Record delivery
      await sb.from("deliveries").insert({
        match_id: matchId,
        over_id: overCtrl.id,
        over_no: overNo,
        innings_no: currentInnings,
        ball_no: ballInOver || 1,
        delivery_no: ballInOver || 1,
        runs_off_bat: isWicket ? 0 : runsOffBat,
        extras_type: extrasType,
        extras_runs: extrasRuns,
        is_wicket: isWicket,
      });

      // Auto-manage prediction windows
      await managePredictionWindow(sb, matchId, overCtrl.id, {
        runsOffBat: isWicket ? 0 : runsOffBat,
        extrasType,
        isWicket,
      });
    }

    // Determine phase
    let phase = "innings1";
    if (currentInnings === 2) phase = "innings2";
    if (matchData.matchEnded) phase = "ended";

    // Update match_live_state
    await sb
      .from("match_live_state")
      .update({
        innings1_score: inn1Score,
        innings1_wickets: inn1Wickets,
        innings1_overs: inn1Overs,
        innings2_score: inn2Score,
        innings2_wickets: inn2Wickets,
        innings2_overs: inn2Overs,
        current_innings: currentInnings,
        phase,
        target_runs: currentInnings === 2 ? inn1Score + 1 : null,
        updated_at: new Date().toISOString(),
      })
      .eq("match_id", matchId);

    // Update match status if ended
    if (matchData.matchEnded) {
      await sb.from("matches").update({ status: "ended" }).eq("id", matchId);
    }
  }

  // Update sync state
  await sb
    .from("api_sync_state")
    .update({
      last_innings1_score: inn1Score,
      last_innings1_wickets: inn1Wickets,
      last_innings1_overs: inn1Overs,
      last_innings2_score: inn2Score,
      last_innings2_wickets: inn2Wickets,
      last_innings2_overs: inn2Overs,
      last_synced_at: new Date().toISOString(),
    })
    .eq("match_id", matchId);
}

// Sync using full scorecard data
async function syncFromScorecard(sb: any, matchId: string, state: any, data: any) {
  // Extract innings scores from scorecard
  const scorecard = data.scorecard || data.score || [];
  let inn1Score = 0, inn1Wickets = 0, inn1Overs = 0;
  let inn2Score = 0, inn2Wickets = 0, inn2Overs = 0;

  if (Array.isArray(scorecard)) {
    for (let i = 0; i < scorecard.length; i++) {
      const inn = scorecard[i];
      const runs = inn.r ?? inn.runs ?? 0;
      const wickets = inn.w ?? inn.wickets ?? 0;
      const overs = inn.o ?? inn.overs ?? 0;
      if (i === 0) { inn1Score = runs; inn1Wickets = wickets; inn1Overs = overs; }
      else { inn2Score = runs; inn2Wickets = wickets; inn2Overs = overs; }
    }
  }

  // Also try data.score array if scorecard didn't give us data
  if (inn1Score === 0 && data.score && Array.isArray(data.score)) {
    for (let i = 0; i < data.score.length; i++) {
      const s = data.score[i];
      if (i === 0) { inn1Score = s.r || 0; inn1Wickets = s.w || 0; inn1Overs = s.o || 0; }
      else { inn2Score = s.r || 0; inn2Wickets = s.w || 0; inn2Overs = s.o || 0; }
    }
  }

  // Use the same delta logic as basic sync
  await syncFromBasicData(sb, matchId, state, {
    score: [
      { r: inn1Score, w: inn1Wickets, o: inn1Overs, inning: "Inning 1" },
      { r: inn2Score, w: inn2Wickets, o: inn2Overs, inning: "Inning 2" },
    ],
    matchEnded: data.matchEnded ?? false,
  });

  // Additionally sync batting/bowling lineup from scorecard
  if (data.scorecard && Array.isArray(data.scorecard)) {
    for (const innings of data.scorecard) {
      const batting = innings.batting || [];
      const bowling = innings.bowling || [];

      for (const bat of batting) {
        const playerName = bat.batsman?.name || bat.batsman;
        if (!playerName) continue;

        // Upsert player
        const { data: existingPlayer } = await sb
          .from("players")
          .select("id")
          .eq("name", playerName)
          .maybeSingle();

        if (!existingPlayer) {
          await sb.from("players").insert({ name: playerName, role: "batsman" });
        }
      }

      for (const bowl of bowling) {
        const playerName = bowl.bowler?.name || bowl.bowler;
        if (!playerName) continue;

        const { data: existingPlayer } = await sb
          .from("players")
          .select("id")
          .eq("name", playerName)
          .maybeSingle();

        if (!existingPlayer) {
          await sb.from("players").insert({ name: playerName, role: "bowler" });
        }
      }
    }
  }
}

// Manage prediction windows automatically
async function managePredictionWindow(
  sb: any,
  matchId: string,
  overId: string,
  outcome: { runsOffBat: number; extrasType: string; isWicket: boolean }
) {
  // Lock any currently open window
  await sb
    .from("prediction_windows")
    .update({ status: "locked", locks_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("status", "open");

  // Resolve last locked window with the outcome
  const { data: lockedWindows } = await sb
    .from("prediction_windows")
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "locked")
    .order("created_at", { ascending: false })
    .limit(1);

  if (lockedWindows && lockedWindows.length > 0) {
    // Determine correct answer key
    let answerKey = "dot_ball";
    if (outcome.isWicket) answerKey = "wicket";
    else if (outcome.extrasType === "wide") answerKey = "wide";
    else if (outcome.extrasType === "no_ball") answerKey = "no_ball";
    else if (outcome.runsOffBat === 1) answerKey = "runs_1";
    else if (outcome.runsOffBat === 2) answerKey = "runs_2";
    else if (outcome.runsOffBat === 3) answerKey = "runs_3";
    else if (outcome.runsOffBat === 4) answerKey = "boundary_4";
    else if (outcome.runsOffBat === 6) answerKey = "six_6";
    else if (outcome.runsOffBat === 5) answerKey = "runs_3"; // approximate

    await sb
      .from("prediction_windows")
      .update({
        status: "resolved",
        correct_answer: { key: answerKey },
      })
      .eq("id", lockedWindows[0].id);

    // Score predictions for this window
    const { data: predictions } = await sb
      .from("predictions")
      .select("id, mobile, player_name, prediction")
      .eq("window_id", lockedWindows[0].id);

    if (predictions) {
      for (const pred of predictions) {
        const predKey = pred.prediction?.key;
        const isCorrect = predKey === answerKey;

        await sb
          .from("predictions")
          .update({
            is_correct: isCorrect,
            points_earned: isCorrect ? 10 : 0,
          })
          .eq("id", pred.id);

        if (isCorrect) {
          // Update leaderboard
          const { data: lb } = await sb
            .from("leaderboard")
            .select("id, total_points, correct_predictions, total_predictions")
            .eq("match_id", matchId)
            .eq("mobile", pred.mobile)
            .maybeSingle();

          if (lb) {
            await sb
              .from("leaderboard")
              .update({
                total_points: lb.total_points + 10,
                correct_predictions: lb.correct_predictions + 1,
                total_predictions: lb.total_predictions + 1,
                last_correct_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
              })
              .eq("id", lb.id);
          } else {
            await sb.from("leaderboard").insert({
              match_id: matchId,
              mobile: pred.mobile,
              player_name: pred.player_name,
              total_points: 10,
              correct_predictions: 1,
              total_predictions: 1,
              last_correct_at: new Date().toISOString(),
            });
          }
        } else {
          // Update total_predictions for incorrect
          const { data: lb } = await sb
            .from("leaderboard")
            .select("id, total_predictions")
            .eq("match_id", matchId)
            .eq("mobile", pred.mobile)
            .maybeSingle();

          if (lb) {
            await sb
              .from("leaderboard")
              .update({
                total_predictions: lb.total_predictions + 1,
                last_updated: new Date().toISOString(),
              })
              .eq("id", lb.id);
          } else {
            await sb.from("leaderboard").insert({
              match_id: matchId,
              mobile: pred.mobile,
              player_name: pred.player_name,
              total_predictions: 1,
            });
          }
        }
      }
    }
  }

  // Open a new prediction window for the next ball
  const standardOptions = [
    { key: "dot_ball", label: "Dot Ball" },
    { key: "runs_1", label: "1 Run" },
    { key: "runs_2", label: "2 Runs" },
    { key: "runs_3", label: "3 Runs" },
    { key: "boundary_4", label: "Boundary (4)" },
    { key: "six_6", label: "Six (6)" },
    { key: "wide", label: "Wide" },
    { key: "no_ball", label: "No Ball" },
    { key: "wicket", label: "Wicket" },
    { key: "leg_bye", label: "Leg Bye" },
    { key: "bye", label: "Bye" },
  ];

  await sb.from("prediction_windows").insert({
    match_id: matchId,
    over_id: overId,
    window_type: "ball",
    question: "What will happen on the next ball?",
    options: standardOptions,
    status: "open",
    opens_at: new Date().toISOString(),
  });
}

// ── STATUS ───────────────────────────────────────────────────────────
async function handleStatus(sb: any) {
  const { data } = await sb
    .from("api_sync_state")
    .select("*, matches(id, name, status, external_match_id)")
    .order("last_synced_at", { ascending: false });

  return json({ sync_states: data || [] });
}
