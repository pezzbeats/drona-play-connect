import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROANUZ_BASE = "https://api.sports.roanuz.com/v5/cricket";
// IPL 2025 tournament key — adjust if needed
const IPL_TOURNAMENT_KEY = "ipl_2025";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const ROANUZ_API_KEY = Deno.env.get("ROANUZ_API_KEY");
  const ROANUZ_PROJECT_KEY = Deno.env.get("ROANUZ_PROJECT_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ROANUZ_API_KEY || !ROANUZ_PROJECT_KEY) {
    return json({ error: "ROANUZ_API_KEY or ROANUZ_PROJECT_KEY not configured" }, 500);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "discover";

  const roanuzHeaders = { "rs-token": ROANUZ_API_KEY };

  try {
    if (action === "discover") {
      return await handleDiscover(sb, ROANUZ_PROJECT_KEY, roanuzHeaders);
    } else if (action === "sync") {
      return await handleSync(sb, ROANUZ_PROJECT_KEY, roanuzHeaders);
    } else if (action === "lineup") {
      const matchId = url.searchParams.get("match_id");
      if (!matchId) return json({ error: "match_id required" }, 400);
      return await handleLineup(sb, ROANUZ_PROJECT_KEY, roanuzHeaders, matchId);
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
async function handleDiscover(sb: any, projectKey: string, headers: any) {
  const res = await fetch(
    `${ROANUZ_BASE}/${projectKey}/tournament/${IPL_TOURNAMENT_KEY}/fixtures/`,
    { headers }
  );
  const body = await res.json();
  
  if (!body.data) return json({ error: "API error", detail: body }, 502);

  // Get active event
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const eventId = event?.id;
  if (!eventId) return json({ error: "No active event found" }, 400);

  const matches = body.data?.matches || [];
  
  // Filter today's and upcoming matches (within 24h)
  const now = new Date();
  const todayMatches = matches.filter((m: any) => {
    const startTime = m.start_at ? new Date(m.start_at * 1000) : null;
    if (!startTime) return false;
    const diffMs = startTime.getTime() - now.getTime();
    // Include matches from 6h ago to 24h ahead
    return diffMs > -6 * 3600 * 1000 && diffMs < 24 * 3600 * 1000;
  });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const m of todayMatches) {
    const extId = m.key;
    
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

    // Extract teams
    const teams = m.teams || {};
    const teamKeys = Object.keys(teams);
    const teamIds: string[] = [];

    for (const tKey of teamKeys.slice(0, 2)) {
      const t = teams[tKey];
      const tName = t.name || tKey;
      const shortCode = (t.short_name || tKey).toUpperCase().slice(0, 3);

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

    // Build match name
    const teamNames = teamKeys.slice(0, 2).map((k) => teams[k]?.name || k);
    const matchName = m.name || `${teamNames[0]} vs ${teamNames[1]}`;
    const opponent = teamNames.length > 1 ? teamNames[1] : null;
    const startTime = m.start_at ? new Date(m.start_at * 1000).toISOString() : null;

    // Map status
    let status: string = "draft";
    const mStatus = (m.status_str || "").toLowerCase();
    if (mStatus.includes("live") || mStatus.includes("in progress")) status = "live";
    else if (mStatus.includes("completed") || mStatus.includes("result")) status = "ended";
    else if (startTime) status = "registrations_open";

    const { data: newMatch, error: matchErr } = await sb
      .from("matches")
      .insert({
        event_id: eventId,
        name: matchName,
        opponent,
        match_type: "group",
        venue: m.venue?.name || "",
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

    // Create scoring config & flags
    await sb.from("match_scoring_config").insert({ match_id: matchId });
    await sb.from("match_flags").insert({ match_id: matchId });

    // Create sync state
    await sb.from("api_sync_state").insert({
      match_id: matchId,
      external_match_id: extId,
    });

    created.push(extId);
  }

  return json({
    discovered: todayMatches.length,
    created: created.length,
    skipped: skipped.length,
    created_ids: created,
    skipped_ids: skipped,
  });
}

// ── LINEUP ──────────────────────────────────────────────────────────
async function handleLineup(sb: any, projectKey: string, headers: any, matchId: string) {
  // Get external match ID
  const { data: syncState } = await sb
    .from("api_sync_state")
    .select("external_match_id")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!syncState) return json({ error: "Match not linked to API" }, 404);

  const res = await fetch(
    `${ROANUZ_BASE}/${projectKey}/match/${syncState.external_match_id}/`,
    { headers }
  );
  const body = await res.json();
  if (!body.data) return json({ error: "API error", detail: body }, 502);

  const matchData = body.data;
  const playingXI = matchData.play || {};
  let playersAdded = 0;

  // Get roster to map team keys to team IDs
  const { data: roster } = await sb
    .from("match_roster")
    .select("team_id, side, teams(name)")
    .eq("match_id", matchId);

  for (const teamKey of Object.keys(playingXI)) {
    const teamPlayers = playingXI[teamKey]?.playing_xi || [];
    
    // Find matching team_id from roster
    const rosterEntry = roster?.find((r: any) => {
      const teamName = r.teams?.name?.toLowerCase() || "";
      return teamName.includes(teamKey.toLowerCase()) || teamKey.toLowerCase().includes(teamName.split(" ")[0]?.toLowerCase());
    });
    const teamId = rosterEntry?.team_id;

    for (let i = 0; i < teamPlayers.length; i++) {
      const p = teamPlayers[i];
      const playerName = p.player?.name || p.name || "";
      if (!playerName) continue;

      // Map Roanuz role to our enum
      let role: string = "batsman";
      const pRole = (p.player?.playing_role || p.playing_role || "").toLowerCase();
      if (pRole.includes("bowl")) role = "bowler";
      else if (pRole.includes("all")) role = "all_rounder";
      else if (pRole.includes("wk") || pRole.includes("keeper")) role = "wicketkeeper";

      // Upsert player
      const { data: existingPlayer } = await sb
        .from("players")
        .select("id")
        .eq("name", playerName)
        .maybeSingle();

      let playerId: string;
      if (existingPlayer) {
        playerId = existingPlayer.id;
        if (teamId) {
          await sb.from("players").update({ team_id: teamId, role }).eq("id", playerId);
        }
      } else {
        const { data: newPlayer } = await sb
          .from("players")
          .insert({ name: playerName, role, team_id: teamId || null })
          .select("id")
          .single();
        playerId = newPlayer?.id;
      }

      if (playerId && teamId) {
        // Upsert match_lineup
        const { data: existingLineup } = await sb
          .from("match_lineup")
          .select("id")
          .eq("match_id", matchId)
          .eq("player_id", playerId)
          .maybeSingle();

        if (!existingLineup) {
          await sb.from("match_lineup").insert({
            match_id: matchId,
            team_id: teamId,
            player_id: playerId,
            batting_order: i + 1,
            is_captain: p.is_captain || false,
            is_wk: role === "wicketkeeper",
          });
          playersAdded++;
        }
      }
    }
  }

  return json({ success: true, players_added: playersAdded });
}

// ── SYNC ─────────────────────────────────────────────────────────────
async function handleSync(sb: any, projectKey: string, headers: any) {
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
      // Fetch match data (scorecard + status)
      const matchRes = await fetch(
        `${ROANUZ_BASE}/${projectKey}/match/${extId}/`,
        { headers }
      );
      const matchBody = await matchRes.json();

      if (!matchBody.data) {
        results.push({ match_id: matchId, status: "error", reason: "no data from API" });
        continue;
      }

      const matchData = matchBody.data;

      // Extract scores from innings
      const innings = matchData.innings || {};
      const inningsKeys = Object.keys(innings);
      let inn1Score = 0, inn1Wickets = 0, inn1Overs = 0;
      let inn2Score = 0, inn2Wickets = 0, inn2Overs = 0;

      if (inningsKeys.length >= 1) {
        const i1 = innings[inningsKeys[0]];
        inn1Score = i1?.score || i1?.runs || 0;
        inn1Wickets = i1?.wickets || 0;
        inn1Overs = i1?.overs || 0;
      }
      if (inningsKeys.length >= 2) {
        const i2 = innings[inningsKeys[1]];
        inn2Score = i2?.score || i2?.runs || 0;
        inn2Wickets = i2?.wickets || 0;
        inn2Overs = i2?.overs || 0;
      }

      // Now fetch ball-by-ball for the current innings
      const currentInnings = inn2Overs > 0 || inn2Score > 0 ? 2 : 1;
      const currentInningsKey = inningsKeys[currentInnings - 1];

      // Determine current over from overs
      const currentOvers = currentInnings === 1 ? inn1Overs : inn2Overs;
      const currentOverNo = Math.floor(currentOvers);

      // Fetch ball-by-ball for latest over
      let newDeliveries = 0;
      if (currentInningsKey) {
        const bbbRes = await fetch(
          `${ROANUZ_BASE}/${projectKey}/match/${extId}/ball-by-ball/`,
          { headers }
        );
        const bbbBody = await bbbRes.json();

        if (bbbBody.data) {
          const overs = bbbBody.data.overs || bbbBody.data.over_groups || {};
          
          // Get existing delivery count to know what's new
          const { count: existingCount } = await sb
            .from("deliveries")
            .select("id", { count: "exact", head: true })
            .eq("match_id", matchId)
            .eq("innings_no", currentInnings);

          // Flatten all balls from all overs
          const allBalls: any[] = [];
          for (const overKey of Object.keys(overs)) {
            const overData = overs[overKey];
            const balls = overData?.balls || overData?.deliveries || [];
            const overNo = overData?.over_number ?? parseInt(overKey) + 1;
            for (const ball of balls) {
              allBalls.push({ ...ball, _overNo: overNo });
            }
          }

          // Only process balls we haven't seen yet
          const newBalls = allBalls.slice(existingCount || 0);

          for (const ball of newBalls) {
            const overNo = ball._overNo;
            const ballNo = ball.ball_number || ball.ball || 1;

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

            if (!overCtrl) continue;

            // Map ball data to delivery
            const runsOffBat = ball.runs?.batting || ball.batsman_runs || ball.runs || 0;
            const extrasRuns = ball.runs?.extras || ball.extras_runs || 0;
            let extrasType = "none";
            const ballExtras = ball.extras || {};
            if (ballExtras.wide || ball.is_wide) extrasType = "wide";
            else if (ballExtras.no_ball || ball.is_no_ball) extrasType = "no_ball";
            else if (ballExtras.bye || ball.is_bye) extrasType = "bye";
            else if (ballExtras.leg_bye || ball.is_leg_bye) extrasType = "leg_bye";

            const isWicket = ball.wicket?.is_out || ball.is_wicket || false;
            const wicketType = ball.wicket?.type || ball.wicket_type || null;
            const isBoundary = ball.runs?.is_boundary || ball.is_boundary || false;

            // Insert delivery
            await sb.from("deliveries").insert({
              match_id: matchId,
              over_id: overCtrl.id,
              over_no: overNo,
              innings_no: currentInnings,
              ball_no: ballNo,
              delivery_no: ballNo,
              runs_off_bat: runsOffBat,
              extras_type: extrasType,
              extras_runs: extrasRuns,
              is_wicket: isWicket,
              wicket_type: wicketType,
            });

            // ── REALTIME PREDICTION WINDOW MANAGEMENT ──
            await managePredictionWindow(sb, matchId, overCtrl.id, {
              runsOffBat,
              extrasType,
              extrasRuns,
              isWicket,
              isBoundary,
            });

            newDeliveries++;
          }
        }
      }

      // Determine phase
      let phase = "innings1";
      const mStatus = (matchData.status_str || "").toLowerCase();
      if (currentInnings === 2) phase = "innings2";
      if (mStatus.includes("completed") || mStatus.includes("result")) phase = "ended";
      if (mStatus.includes("break") || mStatus.includes("innings break")) phase = "break";

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
      if (phase === "ended") {
        await sb.from("matches").update({ status: "ended" }).eq("id", matchId);
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

      results.push({
        match_id: matchId,
        status: "synced",
        new_deliveries: newDeliveries,
        score: `${inn1Score}/${inn1Wickets} (${inn1Overs}ov)${currentInnings === 2 ? ` | ${inn2Score}/${inn2Wickets} (${inn2Overs}ov)` : ""}`,
      });
    } catch (e: any) {
      console.error(`Sync error for ${matchId}:`, e);
      results.push({ match_id: matchId, status: "error", reason: e.message });
    }
  }

  return json({ synced: results.length, results });
}

// ── PREDICTION WINDOW MANAGEMENT (REALTIME) ─────────────────────────
async function managePredictionWindow(
  sb: any,
  matchId: string,
  overId: string,
  outcome: {
    runsOffBat: number;
    extrasType: string;
    extrasRuns: number;
    isWicket: boolean;
    isBoundary: boolean;
  }
) {
  // 1. Lock any currently open window immediately (realtime closure)
  await sb
    .from("prediction_windows")
    .update({ status: "locked", locks_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("status", "open");

  // 2. Resolve last locked window with the actual outcome
  const { data: lockedWindows } = await sb
    .from("prediction_windows")
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "locked")
    .order("created_at", { ascending: false })
    .limit(1);

  if (lockedWindows && lockedWindows.length > 0) {
    // Determine correct answer key from actual ball data
    let answerKey = "dot_ball";
    if (outcome.isWicket) answerKey = "wicket";
    else if (outcome.extrasType === "wide") answerKey = "wide";
    else if (outcome.extrasType === "no_ball") answerKey = "no_ball";
    else if (outcome.extrasType === "bye") answerKey = "bye";
    else if (outcome.extrasType === "leg_bye") answerKey = "leg_bye";
    else if (outcome.runsOffBat === 6) answerKey = "six_6";
    else if (outcome.runsOffBat === 4 || outcome.isBoundary) answerKey = "boundary_4";
    else if (outcome.runsOffBat === 3) answerKey = "runs_3";
    else if (outcome.runsOffBat === 2) answerKey = "runs_2";
    else if (outcome.runsOffBat === 1) answerKey = "runs_1";
    else if (outcome.runsOffBat === 5) answerKey = "runs_3"; // approximate

    const windowId = lockedWindows[0].id;

    await sb
      .from("prediction_windows")
      .update({
        status: "resolved",
        correct_answer: { key: answerKey },
      })
      .eq("id", windowId);

    // Score all predictions for this window
    await scorePredictions(sb, matchId, windowId, answerKey);
  }

  // 3. Open a new prediction window for the next ball
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

// ── SCORE PREDICTIONS ───────────────────────────────────────────────
async function scorePredictions(
  sb: any,
  matchId: string,
  windowId: string,
  answerKey: string
) {
  const { data: predictions } = await sb
    .from("predictions")
    .select("id, mobile, player_name, prediction")
    .eq("window_id", windowId);

  if (!predictions) return;

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

    // Update leaderboard
    const { data: lb } = await sb
      .from("leaderboard")
      .select("id, total_points, correct_predictions, total_predictions")
      .eq("match_id", matchId)
      .eq("mobile", pred.mobile)
      .maybeSingle();

    if (lb) {
      const update: any = {
        total_predictions: lb.total_predictions + 1,
        last_updated: new Date().toISOString(),
      };
      if (isCorrect) {
        update.total_points = lb.total_points + 10;
        update.correct_predictions = lb.correct_predictions + 1;
        update.last_correct_at = new Date().toISOString();
      }
      await sb.from("leaderboard").update(update).eq("id", lb.id);
    } else {
      await sb.from("leaderboard").insert({
        match_id: matchId,
        mobile: pred.mobile,
        player_name: pred.player_name,
        total_points: isCorrect ? 10 : 0,
        correct_predictions: isCorrect ? 1 : 0,
        total_predictions: 1,
        last_correct_at: isCorrect ? new Date().toISOString() : null,
      });
    }
  }
}

// ── STATUS ───────────────────────────────────────────────────────────
async function handleStatus(sb: any) {
  const { data } = await sb
    .from("api_sync_state")
    .select("*, matches(id, name, status, external_match_id)")
    .order("last_synced_at", { ascending: false });

  return json({ sync_states: data || [] });
}
