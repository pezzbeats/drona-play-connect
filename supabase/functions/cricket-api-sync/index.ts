import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROANUZ_BASE = "https://api.sports.roanuz.com/v5/cricket";
const IPL_TOURNAMENT_KEY = "a-rz--cricket--bcci--iplt20--2026-ZGwl";

// Known IPL team name → short_code + brand color mapping
const IPL_TEAM_MAP: Record<string, { code: string; color: string }> = {
  "chennai super kings": { code: "CSK", color: "#f9cd05" },
  "mumbai indians": { code: "MI", color: "#004BA0" },
  "royal challengers bengaluru": { code: "RCB", color: "#EC1C24" },
  "royal challengers bangalore": { code: "RCB", color: "#EC1C24" },
  "kolkata knight riders": { code: "KKR", color: "#3A225D" },
  "sunrisers hyderabad": { code: "SRH", color: "#FF822A" },
  "delhi capitals": { code: "DC", color: "#004C93" },
  "punjab kings": { code: "PBKS", color: "#ED1B24" },
  "rajasthan royals": { code: "RR", color: "#EA1A85" },
  "gujarat titans": { code: "GT", color: "#1B2133" },
  "lucknow super giants": { code: "LSG", color: "#A72056" },
};

function getIplTeamInfo(name: string): { code: string; color: string } | null {
  const lower = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(IPL_TEAM_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  // Secret storage may lowercase the key; Roanuz keys are case-sensitive (RS5:xxx)
  const rawApiKey = Deno.env.get("ROANUZ_API_KEY") || "";
  const ROANUZ_API_KEY = rawApiKey.startsWith("rs5:") ? "RS5:" + rawApiKey.slice(4) : rawApiKey;
  const ROANUZ_PROJECT_KEY = Deno.env.get("ROANUZ_PROJECT_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ROANUZ_API_KEY || !ROANUZ_PROJECT_KEY) {
    return json({ error: "ROANUZ_API_KEY or ROANUZ_PROJECT_KEY not configured" }, 500);
  }


  // Step 1: Authenticate with Roanuz to get access token
  let accessToken: string;
  try {
    const authRes = await fetch(
      `https://api.sports.roanuz.com/v5/core/${ROANUZ_PROJECT_KEY}/auth/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: ROANUZ_API_KEY }),
      }
    );
    const authBody = await authRes.json();
    if (!authBody.data?.token) {
      console.error("Roanuz auth failed:", JSON.stringify(authBody));
      return json({ error: "Roanuz authentication failed", detail: authBody }, 500);
    }
    accessToken = authBody.data.token;
  } catch (e: any) {
    console.error("Roanuz auth error:", e);
    return json({ error: "Failed to authenticate with Roanuz", detail: e.message }, 500);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "auto";
  const roanuzHeaders = { "rs-token": accessToken };

  try {
    if (action === "auto") {
      // Cron-triggered: discover → lineup → sync (all automatic)
      const discoverResult = await doDiscover(sb, ROANUZ_PROJECT_KEY, roanuzHeaders);
      const lineupResult = await doAutoLineup(sb, ROANUZ_PROJECT_KEY, roanuzHeaders);
      const syncResult = await doSync(sb, ROANUZ_PROJECT_KEY, roanuzHeaders);
      return json({ discover: discoverResult, lineup: lineupResult, sync: syncResult });
    } else if (action === "discover") {
      return json(await doDiscover(sb, ROANUZ_PROJECT_KEY, roanuzHeaders));
    } else if (action === "sync") {
      return json(await doSync(sb, ROANUZ_PROJECT_KEY, roanuzHeaders));
    } else if (action === "lineup") {
      const matchId = url.searchParams.get("match_id");
      if (!matchId) return json({ error: "match_id required" }, 400);
      return json(await doLineup(sb, ROANUZ_PROJECT_KEY, roanuzHeaders, matchId));
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
async function doDiscover(sb: any, projectKey: string, headers: any) {
  const res = await fetch(
    `${ROANUZ_BASE}/${projectKey}/tournament/${IPL_TOURNAMENT_KEY}/fixtures/`,
    { headers }
  );
  const body = await res.json();
  if (!body.data) return { error: "API error", detail: body };

  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!event?.id) return { error: "No active event found" };
  const eventId = event.id;

  const matches = body.data?.matches || [];
  const now = new Date();
  // Compute today's IST boundaries: 00:00 IST to 23:59:59 IST, plus 6h past buffer
  const IST_OFFSET_MS = 5.5 * 3600 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  const todayStartUTC = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 3600 * 1000 - 1);

  const todayMatches = matches.filter((m: any) => {
    const startTime = m.start_at ? new Date(m.start_at * 1000) : null;
    if (!startTime) return false;
    // Include matches starting today (IST) plus 6h buffer for ongoing matches
    return startTime.getTime() >= (todayStartUTC.getTime() - 6 * 3600 * 1000) &&
           startTime.getTime() <= todayEndUTC.getTime();
  });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const m of todayMatches) {
    const extId = m.key;
    const { data: existing } = await sb
      .from("matches")
      .select("id")
      .eq("external_match_id", extId)
      .maybeSingle();

    if (existing) { skipped.push(extId); continue; }

    const teams = m.teams || {};
    const teamKeys = Object.keys(teams);
    const teamIds: string[] = [];

    for (const tKey of teamKeys.slice(0, 2)) {
      const t = teams[tKey];
      const tName = t.name || tKey;
      const iplInfo = getIplTeamInfo(tName);
      const shortCode = iplInfo?.code || (t.short_name || tKey).toUpperCase().slice(0, 3);
      const teamColor = iplInfo?.color || null;
      const { data: existingTeam } = await sb
        .from("teams").select("id").eq("name", tName).maybeSingle();
      if (existingTeam) {
        // Update short_code and color if we have better info
        await sb.from("teams").update({ short_code: shortCode, color: teamColor }).eq("id", existingTeam.id);
        teamIds.push(existingTeam.id);
      } else {
        const { data: newTeam } = await sb
          .from("teams").insert({ name: tName, short_code: shortCode, color: teamColor }).select("id").single();
        if (newTeam) teamIds.push(newTeam.id);
      }
    }

    const teamNames = teamKeys.slice(0, 2).map((k) => teams[k]?.name || k);
    const matchName = m.name || `${teamNames[0]} vs ${teamNames[1]}`;
    const opponent = teamNames.length > 1 ? teamNames[1] : null;
    const startTime = m.start_at ? new Date(m.start_at * 1000).toISOString() : null;

    let status: string = "draft";
    const mStatus = (m.status_str || "").toLowerCase();
    if (mStatus.includes("live") || mStatus.includes("in progress")) status = "live";
    else if (mStatus.includes("completed") || mStatus.includes("result")) status = "ended";
    else if (startTime) status = "registrations_open";

    const { data: newMatch, error: matchErr } = await sb
      .from("matches")
      .insert({
        event_id: eventId, name: matchName, opponent, match_type: "group",
        venue: m.venue?.name || "", start_time: startTime, status,
        external_match_id: extId, predictions_enabled: true, prediction_mode: "per_ball",
        is_active_for_registration: true,
      })
      .select("id").single();

    if (matchErr) { console.error("Failed to create match:", matchErr); continue; }
    const matchId = newMatch.id;

    if (teamIds.length >= 2) {
      await sb.from("match_roster").insert([
        { match_id: matchId, team_id: teamIds[0], side: "home", is_batting_first: false },
        { match_id: matchId, team_id: teamIds[1], side: "away", is_batting_first: false },
      ]);
    }

    await sb.from("match_live_state").insert({
      match_id: matchId, phase: status === "live" ? "innings1" : "pre",
      batting_team_id: teamIds[0] || null, bowling_team_id: teamIds[1] || null,
    });
    await sb.from("match_scoring_config").insert({ match_id: matchId });
    await sb.from("match_flags").insert({ match_id: matchId });
    await sb.from("api_sync_state").insert({ match_id: matchId, external_match_id: extId });
    created.push(extId);
  }

  return { discovered: todayMatches.length, created: created.length, skipped: skipped.length };
}

// ── AUTO LINEUP (fetch for all synced matches that don't have lineup yet) ──
async function doAutoLineup(sb: any, projectKey: string, headers: any) {
  const { data: syncStates } = await sb
    .from("api_sync_state")
    .select("match_id, external_match_id, matches!inner(status)")
    .eq("sync_enabled", true);

  if (!syncStates) return { lineups_fetched: 0 };

  let fetched = 0;
  for (const state of syncStates) {
    const matchStatus = state.matches?.status;
    // Fetch lineup for live or upcoming matches
    if (matchStatus !== "live" && matchStatus !== "registrations_open") continue;

    // Check if lineup already exists
    const { count } = await sb
      .from("match_lineup")
      .select("id", { count: "exact", head: true })
      .eq("match_id", state.match_id);

    if ((count || 0) > 0) continue; // Already has lineup

    try {
      await doLineup(sb, projectKey, headers, state.match_id);
      fetched++;
    } catch (e: any) {
      console.error(`Lineup fetch error for ${state.match_id}:`, e.message);
    }
  }
  return { lineups_fetched: fetched };
}

// ── LINEUP (single match) ────────────────────────────────────────────
async function doLineup(sb: any, projectKey: string, headers: any, matchId: string) {
  const { data: syncState } = await sb
    .from("api_sync_state")
    .select("external_match_id")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!syncState) return { error: "Match not linked to API" };

  const res = await fetch(
    `${ROANUZ_BASE}/${projectKey}/match/${syncState.external_match_id}/`,
    { headers }
  );
  const body = await res.json();
  if (!body.data) return { error: "API error", detail: body };

  const playingXI = body.data.play || {};
  let playersAdded = 0;

  const { data: roster } = await sb
    .from("match_roster")
    .select("team_id, side, teams(name)")
    .eq("match_id", matchId);

  for (const teamKey of Object.keys(playingXI)) {
    const teamPlayers = playingXI[teamKey]?.playing_xi || [];
    const rosterEntry = roster?.find((r: any) => {
      const teamName = r.teams?.name?.toLowerCase() || "";
      return teamName.includes(teamKey.toLowerCase()) ||
        teamKey.toLowerCase().includes(teamName.split(" ")[0]?.toLowerCase());
    });
    const teamId = rosterEntry?.team_id;

    for (let i = 0; i < teamPlayers.length; i++) {
      const p = teamPlayers[i];
      const playerName = p.player?.name || p.name || "";
      if (!playerName) continue;

      let role: string = "batsman";
      const pRole = (p.player?.playing_role || p.playing_role || "").toLowerCase();
      if (pRole.includes("bowl")) role = "bowler";
      else if (pRole.includes("all")) role = "all_rounder";
      else if (pRole.includes("wk") || pRole.includes("keeper")) role = "wicketkeeper";

      const { data: existingPlayer } = await sb
        .from("players").select("id").eq("name", playerName).maybeSingle();

      let playerId: string;
      if (existingPlayer) {
        playerId = existingPlayer.id;
        if (teamId) await sb.from("players").update({ team_id: teamId, role }).eq("id", playerId);
      } else {
        const { data: newPlayer } = await sb
          .from("players").insert({ name: playerName, role, team_id: teamId || null }).select("id").single();
        playerId = newPlayer?.id;
      }

      if (playerId && teamId) {
        const { data: existingLineup } = await sb
          .from("match_lineup").select("id").eq("match_id", matchId).eq("player_id", playerId).maybeSingle();
        if (!existingLineup) {
          await sb.from("match_lineup").insert({
            match_id: matchId, team_id: teamId, player_id: playerId,
            batting_order: i + 1, is_captain: p.is_captain || false,
            is_wk: role === "wicketkeeper",
          });
          playersAdded++;
        }
      }
    }
  }

  return { success: true, players_added: playersAdded };
}

// ── SYNC (scores + ball-by-ball, NO prediction window management) ───
async function doSync(sb: any, projectKey: string, headers: any) {
  const { data: syncStates } = await sb
    .from("api_sync_state")
    .select("*, matches!inner(id, status, external_match_id)")
    .eq("sync_enabled", true);

  if (!syncStates || syncStates.length === 0)
    return { synced: 0, message: "No matches to sync" };

  const results: any[] = [];

  for (const state of syncStates) {
    const matchId = state.match_id;
    const extId = state.external_match_id;
    const matchStatus = state.matches?.status;

    if (matchStatus !== "live") {
      results.push({ match_id: matchId, status: "skipped", reason: "not live" });
      continue;
    }

    try {
      const matchRes = await fetch(
        `${ROANUZ_BASE}/${projectKey}/match/${extId}/`, { headers }
      );
      const matchBody = await matchRes.json();
      if (!matchBody.data) {
        results.push({ match_id: matchId, status: "error", reason: "no data from API" });
        continue;
      }

      const matchData = matchBody.data;
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

      const currentInnings = inn2Overs > 0 || inn2Score > 0 ? 2 : 1;

      // Fetch ball-by-ball and record deliveries
      let newDeliveries = 0;
      const bbbRes = await fetch(
        `${ROANUZ_BASE}/${projectKey}/match/${extId}/ball-by-ball/`, { headers }
      );
      const bbbBody = await bbbRes.json();

      if (bbbBody.data) {
        const overs = bbbBody.data.overs || bbbBody.data.over_groups || {};

        const { count: existingCount } = await sb
          .from("deliveries")
          .select("id", { count: "exact", head: true })
          .eq("match_id", matchId)
          .eq("innings_no", currentInnings);

        const allBalls: any[] = [];
        for (const overKey of Object.keys(overs)) {
          const overData = overs[overKey];
          const balls = overData?.balls || overData?.deliveries || [];
          const overNo = overData?.over_number ?? parseInt(overKey) + 1;
          for (const ball of balls) {
            allBalls.push({ ...ball, _overNo: overNo });
          }
        }

        const newBalls = allBalls.slice(existingCount || 0);

        for (const ball of newBalls) {
          const overNo = ball._overNo;
          const ballNo = ball.ball_number || ball.ball || 1;

          let { data: overCtrl } = await sb
            .from("over_control").select("id")
            .eq("match_id", matchId).eq("innings_no", currentInnings).eq("over_no", overNo)
            .maybeSingle();

          if (!overCtrl) {
            const { data: newOver } = await sb
              .from("over_control")
              .insert({ match_id: matchId, over_no: overNo, innings_no: currentInnings, status: "active" })
              .select("id").single();
            overCtrl = newOver;
          }
          if (!overCtrl) continue;

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

          await sb.from("deliveries").insert({
            match_id: matchId, over_id: overCtrl.id, over_no: overNo,
            innings_no: currentInnings, ball_no: ballNo, delivery_no: ballNo,
            runs_off_bat: runsOffBat, extras_type: extrasType, extras_runs: extrasRuns,
            is_wicket: isWicket, wicket_type: wicketType,
          });

          // NOTE: Prediction windows are NOT auto-managed here.
          // Admin controls prediction window open/lock/resolve via Match Command Center.

          newDeliveries++;
        }
      }

      // Determine phase
      let phase = "innings1";
      const mStatus = (matchData.status_str || "").toLowerCase();
      if (currentInnings === 2) phase = "innings2";
      if (mStatus.includes("completed") || mStatus.includes("result")) phase = "ended";
      if (mStatus.includes("break") || mStatus.includes("innings break")) phase = "break";

      await sb.from("match_live_state").update({
        innings1_score: inn1Score, innings1_wickets: inn1Wickets, innings1_overs: inn1Overs,
        innings2_score: inn2Score, innings2_wickets: inn2Wickets, innings2_overs: inn2Overs,
        current_innings: currentInnings, phase,
        target_runs: currentInnings === 2 ? inn1Score + 1 : null,
        updated_at: new Date().toISOString(),
      }).eq("match_id", matchId);

      if (phase === "ended") {
        await sb.from("matches").update({ status: "ended" }).eq("id", matchId);
      }

      await sb.from("api_sync_state").update({
        last_innings1_score: inn1Score, last_innings1_wickets: inn1Wickets,
        last_innings1_overs: inn1Overs, last_innings2_score: inn2Score,
        last_innings2_wickets: inn2Wickets, last_innings2_overs: inn2Overs,
        last_synced_at: new Date().toISOString(),
      }).eq("match_id", matchId);

      results.push({
        match_id: matchId, status: "synced", new_deliveries: newDeliveries,
        score: `${inn1Score}/${inn1Wickets} (${inn1Overs}ov)${currentInnings === 2 ? ` | ${inn2Score}/${inn2Wickets} (${inn2Overs}ov)` : ""}`,
      });
    } catch (e: any) {
      console.error(`Sync error for ${matchId}:`, e);
      results.push({ match_id: matchId, status: "error", reason: e.message });
    }
  }

  return { synced: results.length, results };
}

// ── STATUS ───────────────────────────────────────────────────────────
async function handleStatus(sb: any) {
  const { data } = await sb
    .from("api_sync_state")
    .select("*, matches(id, name, status, external_match_id)")
    .order("last_synced_at", { ascending: false });
  return json({ sync_states: data || [] });
}
