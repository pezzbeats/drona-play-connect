import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROANUZ_BASE = "https://api.sports.roanuz.com/v5/cricket";
const IPL_TOURNAMENT_KEY = "a-rz--cricket--bcci--iplt20--2026-ZGwl";

// ── Structured logging ───────────────────────────────────────────────
function log(level: "info" | "warn" | "error", message: string, ctx: Record<string, any> = {}) {
  const entry = { level, message, timestamp: new Date().toISOString(), ...ctx };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ── Fetch with exponential backoff & retry ───────────────────────────
async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  const delays = [1000, 3000, 9000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      if (attempt === maxRetries) return res;
      // Respect Retry-After header on 429
      let delay = delays[Math.min(attempt, delays.length - 1)];
      if (res.status === 429) {
        const ra = res.headers.get("Retry-After");
        if (ra) delay = Math.max(delay, parseInt(ra) * 1000 || delay);
      }
      log("warn", `Retrying fetch (attempt ${attempt + 1})`, { url, status: res.status, delay });
      // Consume body to avoid leak
      await res.text();
      await new Promise((r) => setTimeout(r, delay));
    } catch (e: any) {
      if (attempt === maxRetries) throw e;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      log("warn", `Fetch error, retrying (attempt ${attempt + 1})`, { url, error: e.message, delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Shouldn't reach here
  return fetch(url, opts);
}

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

// Map delivery data to prediction outcome key
function deliveryToOutcomeKey(runsOffBat: number, isWicket: boolean, extrasType: string): string {
  if (isWicket) return "wicket";
  if (extrasType === "wide") return "wide";
  if (extrasType === "no_ball") return "no_ball";
  if (runsOffBat === 0) return "dot_ball";
  if (runsOffBat === 1) return "runs_1";
  if (runsOffBat === 2) return "runs_2";
  if (runsOffBat === 3) return "runs_3";
  if (runsOffBat === 4) return "boundary_4";
  if (runsOffBat === 6) return "six_6";
  return `runs_${runsOffBat}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const rawApiKey = Deno.env.get("ROANUZ_API_KEY") || "";
  const ROANUZ_API_KEY = rawApiKey.startsWith("rs5:") ? "RS5:" + rawApiKey.slice(4) : rawApiKey;
  const ROANUZ_PROJECT_KEY = Deno.env.get("ROANUZ_PROJECT_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ROANUZ_API_KEY || !ROANUZ_PROJECT_KEY) {
    return json({ error: "ROANUZ_API_KEY or ROANUZ_PROJECT_KEY not configured" }, 500);
  }

  let accessToken: string;
  try {
    const authRes = await fetchWithRetry(
      `https://api.sports.roanuz.com/v5/core/${ROANUZ_PROJECT_KEY}/auth/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: ROANUZ_API_KEY }),
      }
    );
    const authBody = await authRes.json();
    if (!authBody.data?.token) {
      log("error", "Roanuz auth failed", { detail: authBody });
      return json({ error: "Roanuz authentication failed", detail: authBody }, 500);
    }
    accessToken = authBody.data.token;
  } catch (e: any) {
    log("error", "Roanuz auth error", { error: e.message });
    return json({ error: "Failed to authenticate with Roanuz", detail: e.message }, 500);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "auto";
  const roanuzHeaders = { "rs-token": accessToken };

  try {
    if (action === "auto") {
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
    log("error", "cricket-api-sync top-level error", { error: e.message });
    return json({ error: e.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isApiStatusLive(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase().trim();
  if (s.includes("not_started") || s.includes("completed") || s.includes("result") || s === "not started") return false;
  // Abandoned / no result / postponed are NOT live
  if (s.includes("abandoned") || s.includes("no result") || s.includes("postponed")) return false;
  return (
    s.includes("live") ||
    s.includes("in progress") ||
    s.includes("in_progress") ||
    s === "started" ||
    s.includes("play") ||
    s.includes("innings") ||
    s.includes("stumps") ||
    s.includes("break") ||
    s.includes("strategic") ||
    s.includes("timeout")
  );
}

// Detect abandoned / no-result / postponed statuses
function isAbandonedOrNoResult(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase().trim();
  return s.includes("abandoned") || s.includes("no result") || s.includes("postponed") || s.includes("no_result");
}

// Detect rain delay
function isRainDelay(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase().trim();
  return s.includes("rain") || s.includes("delayed") || s.includes("weather");
}

// ── DISCOVER ─────────────────────────────────────────────────────────
async function doDiscover(sb: any, projectKey: string, headers: any) {
  const res = await fetchWithRetry(
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
  const IST_OFFSET_MS = 5.5 * 3600 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  const todayStartUTC = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const windowStart = new Date(todayStartUTC.getTime() - 6 * 3600 * 1000);
  const windowEnd = new Date(now.getTime() + 48 * 3600 * 1000);

  const todayMatches = matches.filter((m: any) => {
    const startTime = m.start_at ? new Date(m.start_at * 1000) : null;
    if (!startTime) return false;
    return startTime.getTime() >= windowStart.getTime() &&
           startTime.getTime() <= windowEnd.getTime();
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

    const mStatusRaw = m.status_str || m.status || m.play_status || "";
    const mStatus = mStatusRaw.toLowerCase();
    const hasInningsData = m.innings && Object.keys(m.innings).length > 0;
    let status: string = "draft";
    if (isAbandonedOrNoResult(mStatusRaw)) {
      status = "ended";
    } else if (isApiStatusLive(mStatusRaw) || hasInningsData) {
      status = "live";
    } else if (mStatus.includes("completed") || mStatus.includes("result")) {
      status = "ended";
    } else if (startTime) {
      status = "registrations_open";
    }

    const startsWithin24h = startTime ? (new Date(startTime).getTime() - now.getTime()) < 24 * 3600 * 1000 : false;
    const shouldActivate = status === "live" || (startsWithin24h && status !== "ended");

    // Extract toss data if available
    const tossInfo = m.toss;
    let tossStr: string | null = null;
    if (tossInfo) {
      const tossWinner = tossInfo.winner?.name || tossInfo.winner_name || "";
      const tossDecision = tossInfo.decision || tossInfo.elected || "";
      if (tossWinner) tossStr = `Toss: ${tossWinner} elected to ${tossDecision}`;
    }

    const { data: newMatch, error: matchErr } = await sb
      .from("matches")
      .insert({
        event_id: eventId, name: matchName, opponent, match_type: "group",
        venue: m.venue?.name || "", start_time: startTime, status: status === "live" ? "live" : (startsWithin24h ? "registrations_open" : "draft"),
        external_match_id: extId, predictions_enabled: true, prediction_mode: "per_ball",
        is_active_for_registration: shouldActivate,
      })
      .select("id").single();

    if (matchErr) { log("error", "Failed to create match", { error: matchErr, extId }); continue; }
    const matchId = newMatch.id;

    // Determine batting first from toss
    let battingFirstTeamIdx = -1;
    if (tossInfo) {
      const tossWinnerName = (tossInfo.winner?.name || tossInfo.winner_name || "").toLowerCase();
      const tossDecision = (tossInfo.decision || tossInfo.elected || "").toLowerCase();
      const tossWinnerIdx = teamNames.findIndex(n => n.toLowerCase().includes(tossWinnerName) || tossWinnerName.includes(n.toLowerCase().split(" ")[0]));
      if (tossWinnerIdx >= 0) {
        if (tossDecision.includes("bat")) battingFirstTeamIdx = tossWinnerIdx;
        else if (tossDecision.includes("bowl") || tossDecision.includes("field")) battingFirstTeamIdx = tossWinnerIdx === 0 ? 1 : 0;
      }
    }

    if (teamIds.length >= 2) {
      await sb.from("match_roster").insert([
        { match_id: matchId, team_id: teamIds[0], side: "home", is_batting_first: battingFirstTeamIdx === 0 },
        { match_id: matchId, team_id: teamIds[1], side: "away", is_batting_first: battingFirstTeamIdx === 1 },
      ]);
    }

    await sb.from("match_live_state").insert({
      match_id: matchId, phase: status === "live" ? "innings1" : "pre",
      batting_team_id: teamIds[battingFirstTeamIdx >= 0 ? battingFirstTeamIdx : 0] || null,
      bowling_team_id: teamIds[battingFirstTeamIdx >= 0 ? (battingFirstTeamIdx === 0 ? 1 : 0) : 1] || null,
      last_delivery_summary: tossStr,
    });
    await sb.from("match_scoring_config").insert({ match_id: matchId });
    await sb.from("match_flags").insert({ match_id: matchId });
    await sb.from("api_sync_state").insert({ match_id: matchId, external_match_id: extId });
    created.push(extId);
  }

  return { discovered: todayMatches.length, created: created.length, skipped: skipped.length };
}

// ── AUTO LINEUP ──────────────────────────────────────────────────────
async function doAutoLineup(sb: any, projectKey: string, headers: any) {
  const { data: syncStates } = await sb
    .from("api_sync_state")
    .select("match_id, external_match_id, matches!inner(status)")
    .eq("sync_enabled", true);

  if (!syncStates) return { lineups_fetched: 0 };

  let fetched = 0;
  for (const state of syncStates) {
    const matchStatus = state.matches?.status;
    if (matchStatus !== "live" && matchStatus !== "registrations_open") continue;

    const { count } = await sb
      .from("match_lineup")
      .select("id", { count: "exact", head: true })
      .eq("match_id", state.match_id);

    if ((count || 0) > 0) continue;

    try {
      await doLineup(sb, projectKey, headers, state.match_id);
      fetched++;
    } catch (e: any) {
      log("error", "Lineup fetch error", { match_id: state.match_id, error: e.message });
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

  const res = await fetchWithRetry(
    `${ROANUZ_BASE}/${projectKey}/match/${syncState.external_match_id}/`,
    { headers }
  );
  const body = await res.json();
  if (!body.data) return { error: "API error", detail: body };

  const matchData = body.data;

  // Extract toss data and update roster if not already set
  const tossInfo = matchData.toss;
  if (tossInfo) {
    const { data: roster } = await sb
      .from("match_roster")
      .select("team_id, side, is_batting_first, teams(name)")
      .eq("match_id", matchId);

    const hasBattingFirst = roster?.some((r: any) => r.is_batting_first);
    if (!hasBattingFirst && roster && roster.length >= 2) {
      const tossWinnerName = (tossInfo.winner?.name || tossInfo.winner_name || "").toLowerCase();
      const tossDecision = (tossInfo.decision || tossInfo.elected || "").toLowerCase();

      for (const r of roster) {
        const teamName = (r.teams?.name || "").toLowerCase();
        const isWinner = teamName.includes(tossWinnerName) || tossWinnerName.includes(teamName.split(" ")[0]);
        let isBattingFirst = false;
        if (isWinner && tossDecision.includes("bat")) isBattingFirst = true;
        if (!isWinner && (tossDecision.includes("bowl") || tossDecision.includes("field"))) isBattingFirst = true;
        if (isBattingFirst) {
          await sb.from("match_roster").update({ is_batting_first: true }).eq("team_id", r.team_id).eq("match_id", matchId);
          // Update live state toss info
          const tossStr = `Toss: ${tossInfo.winner?.name || tossInfo.winner_name} elected to ${tossDecision}`;
          await sb.from("match_live_state").update({ last_delivery_summary: tossStr }).eq("match_id", matchId).eq("phase", "pre");
        }
      }
    }
  }

  const playingXI = matchData.play || {};
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

// ── SYNC (scores + ball-by-ball + auto-activation + prediction lifecycle) ───
async function doSync(sb: any, projectKey: string, headers: any) {
  const { data: syncStates } = await sb
    .from("api_sync_state")
    .select("*, matches!inner(id, status, external_match_id, predictions_enabled, prediction_mode, start_time)")
    .eq("sync_enabled", true);

  if (!syncStates || syncStates.length === 0)
    return { synced: 0, message: "No matches to sync" };

  const results: any[] = [];
  let recommendedInterval = 15; // default 15s (was 20s)

  for (const state of syncStates) {
    const matchId = state.match_id;
    const extId = state.external_match_id;
    const matchStatus = state.matches?.status;

    // Auto-lock expired prediction windows
    await sb
      .from("prediction_windows")
      .update({ status: "locked" })
      .eq("match_id", matchId)
      .eq("status", "open")
      .not("locks_at", "is", null)
      .lte("locks_at", new Date().toISOString());

    if (matchStatus === "ended") {
      results.push({ match_id: matchId, status: "skipped", reason: `status is ended` });
      continue;
    }

    // Auto-promote draft → registrations_open if start_time within 24h
    if (matchStatus === "draft") {
      const matchStartTime = state.matches?.start_time ? new Date(state.matches.start_time) : null;
      const hoursUntilStart = matchStartTime ? (matchStartTime.getTime() - Date.now()) / (3600 * 1000) : Infinity;
      if (hoursUntilStart <= 24) {
        await sb.from("matches").update({
          status: "registrations_open",
          is_active_for_registration: true,
        }).eq("id", matchId);
        log("info", "Auto-promoted draft → registrations_open", { match_id: matchId, hours_until_start: hoursUntilStart.toFixed(1) });
        // Continue to sync (don't skip)
      } else {
        results.push({ match_id: matchId, status: "skipped", reason: `draft, starts in ${hoursUntilStart.toFixed(0)}h` });
        continue;
      }
    }

    try {
      const matchRes = await fetchWithRetry(
        `${ROANUZ_BASE}/${projectKey}/match/${extId}/`, { headers }
      );
      const matchBody = await matchRes.json();
      if (!matchBody.data) {
        results.push({ match_id: matchId, status: "error", reason: "no data from API" });
        continue;
      }

      const matchData = matchBody.data;
      const apiStatusStr = matchData.status_str || matchData.status || matchData.play_status || "";
      const inningsObj = matchData.innings || matchData.play?.innings || {};
      const hasInningsData = inningsObj && typeof inningsObj === "object" && Object.keys(inningsObj).length > 0;
      log("info", "Match sync status", { match_id: matchId, ext_id: extId, api_status: apiStatusStr, has_innings: hasInningsData });

      const statusLower = (apiStatusStr || "").toLowerCase();
      const isExplicitlyCompleted = statusLower.includes("completed") || statusLower.includes("result");

      // Handle abandoned/no-result/postponed
      if (isAbandonedOrNoResult(apiStatusStr)) {
        await sb.from("match_live_state").update({
          phase: "ended",
          last_delivery_summary: apiStatusStr,
          updated_at: new Date().toISOString(),
        }).eq("match_id", matchId);
        await sb.from("matches").update({ status: "ended" }).eq("id", matchId);
        // Lock remaining windows
        await sb.from("prediction_windows")
          .update({ status: "locked", locks_at: new Date().toISOString() })
          .eq("match_id", matchId).eq("status", "open");
        results.push({ match_id: matchId, status: "ended_abandoned", reason: apiStatusStr });
        continue;
      }

      // Handle rain delay
      if (isRainDelay(apiStatusStr) && !isExplicitlyCompleted) {
        await sb.from("match_live_state").update({
          last_delivery_summary: `🌧 Rain Delay — ${apiStatusStr}`,
          updated_at: new Date().toISOString(),
        }).eq("match_id", matchId);
        results.push({ match_id: matchId, status: "rain_delay", reason: apiStatusStr });
        continue;
      }

      const apiIsLive = isApiStatusLive(apiStatusStr) || (hasInningsData && !isExplicitlyCompleted);

      // Auto-re-discover
      const matchStartTime = state.matches?.start_time ? new Date(state.matches.start_time) : null;
      const startTimePassed = matchStartTime && matchStartTime.getTime() < Date.now();
      if ((matchStatus === "live") && !apiIsLive && startTimePassed) {
        if (isExplicitlyCompleted || statusLower.includes("not_started") || statusLower === "not started") {
          log("warn", "Match appears mislinked, attempting re-discovery", { match_id: matchId, api_status: apiStatusStr });
          const correctExtId = await rediscoverMatchId(sb, projectKey, headers, matchId);
          if (correctExtId && correctExtId !== extId) {
            await sb.from("api_sync_state").update({ external_match_id: correctExtId }).eq("match_id", matchId);
            results.push({ match_id: matchId, status: "relinked", old_ext_id: extId, new_ext_id: correctExtId });
            continue;
          }
        }
      }

      // Auto-activate: registrations_open → live
      if (matchStatus === "registrations_open" && apiIsLive) {
        await sb.from("matches").update({
          status: "live",
          is_active_for_registration: true,
        }).eq("id", matchId);

        await sb.from("match_live_state").update({
          phase: "innings1",
        }).eq("match_id", matchId);

        log("info", "Auto-activated match to live", { match_id: matchId });
      }

      if (matchStatus === "registrations_open" && !apiIsLive) {
        // Update toss info even if not live yet
        const tossInfo = matchData.toss;
        if (tossInfo) {
          const tossWinner = tossInfo.winner?.name || tossInfo.winner_name || "";
          const tossDecision = tossInfo.decision || tossInfo.elected || "";
          if (tossWinner) {
            const tossStr = `Toss: ${tossWinner} elected to ${tossDecision}`;
            await sb.from("match_live_state").update({
              last_delivery_summary: tossStr,
              updated_at: new Date().toISOString(),
            }).eq("match_id", matchId);
          }
        }
        results.push({ match_id: matchId, status: "skipped", reason: "not live yet per API" });
        continue;
      }

      const innings = matchData.innings || matchData.play?.innings || {};
      const inningsKeys = Object.keys(innings);
      let inn1Score = 0, inn1Wickets = 0, inn1Overs = 0;
      let inn2Score = 0, inn2Wickets = 0, inn2Overs = 0;

      const getNum = (val: any): number => {
        if (typeof val === "number") return val;
        if (typeof val === "object" && val !== null) return val.runs ?? val.value ?? val.score ?? 0;
        return parseInt(val) || 0;
      };

      const getOvers = (innings: any): number => {
        if (typeof innings?.overs === "number") return innings.overs;
        const balls = innings?.score?.balls;
        if (typeof balls === "number" && balls > 0) {
          return Math.floor(balls / 6) + (balls % 6) / 10;
        }
        if (Array.isArray(innings?.overs)) return innings.overs.length;
        return 0;
      };

      const getWickets = (innings: any): number => {
        if (typeof innings?.wickets === "number") return innings.wickets;
        if (Array.isArray(innings?.wickets)) return innings.wickets.length;
        if (Array.isArray(innings?.wicket_order)) return innings.wicket_order.length;
        return 0;
      };

      if (inningsKeys.length >= 1) {
        const i1 = innings[inningsKeys[0]];
        log("info", "Innings 1 data", { match_id: matchId, score_type: typeof i1?.score, score_raw: JSON.stringify(i1?.score)?.slice(0, 100) });
        inn1Score = getNum(i1?.score) || getNum(i1?.runs) || 0;
        inn1Wickets = getWickets(i1);
        inn1Overs = getOvers(i1);
      }
      if (inningsKeys.length >= 2) {
        const i2 = innings[inningsKeys[1]];
        inn2Score = getNum(i2?.score) || getNum(i2?.runs) || 0;
        inn2Wickets = getWickets(i2);
        inn2Overs = getOvers(i2);
      }

      const currentInnings = inn2Overs > 0 || inn2Score > 0 ? 2 : 1;

      // DLS target adjustment
      let dlsTarget: number | null = null;
      const dlsData = matchData.dls || matchData.dl || matchData.revised_target;
      if (dlsData) {
        if (typeof dlsData === "number") dlsTarget = dlsData;
        else if (typeof dlsData === "object") dlsTarget = dlsData.target || dlsData.par_score || dlsData.revised_target || null;
      }

      // Fetch ball-by-ball and record deliveries
      let newDeliveries = 0;
      const bbbRes = await fetchWithRetry(
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

          // Auto-lock open prediction windows BEFORE inserting delivery
          const { data: openWindows } = await sb
            .from("prediction_windows")
            .select("id")
            .eq("match_id", matchId)
            .eq("status", "open");

          if (openWindows && openWindows.length > 0) {
            const windowIds = openWindows.map((w: any) => w.id);
            await sb
              .from("prediction_windows")
              .update({ status: "locked", locks_at: new Date().toISOString() })
              .in("id", windowIds);

            const outcomeKey = deliveryToOutcomeKey(runsOffBat, isWicket, extrasType);
            const correctAnswer = { key: outcomeKey };

            for (const wId of windowIds) {
              await sb
                .from("prediction_windows")
                .update({ status: "resolved", correct_answer: correctAnswer })
                .eq("id", wId);

              await scorePredictions(sb, matchId, wId, outcomeKey);
            }
          }

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

          await sb.from("deliveries").insert({
            match_id: matchId, over_id: overCtrl.id, over_no: overNo,
            innings_no: currentInnings, ball_no: ballNo, delivery_no: ballNo,
            runs_off_bat: runsOffBat, extras_type: extrasType, extras_runs: extrasRuns,
            is_wicket: isWicket, wicket_type: wicketType,
          });

          newDeliveries++;
        }

        // Auto-open next prediction window
        const predictionsEnabled = state.matches?.predictions_enabled;
        const predictionMode = state.matches?.prediction_mode;
        if (predictionsEnabled && predictionMode !== "off" && newDeliveries > 0) {
          const { data: existingOpen } = await sb
            .from("prediction_windows")
            .select("id")
            .eq("match_id", matchId)
            .eq("status", "open")
            .maybeSingle();

          if (!existingOpen) {
            const now = new Date();
            const locksAt = new Date(now.getTime() + 12_000);
            await sb.from("prediction_windows").insert({
              match_id: matchId,
              window_type: "ball",
              status: "open",
              question: "What will happen on the next ball?",
              options: [
                { key: "dot_ball", label: "Dot Ball" },
                { key: "runs_1", label: "1 Run" },
                { key: "runs_2", label: "2 Runs" },
                { key: "runs_3", label: "3 Runs" },
                { key: "boundary_4", label: "4 Boundary" },
                { key: "six_6", label: "6 Sixer" },
                { key: "wide", label: "Wide" },
                { key: "no_ball", label: "No Ball" },
                { key: "wicket", label: "Wicket 🏏" },
              ],
              opens_at: now.toISOString(),
              locks_at: locksAt.toISOString(),
            });
          }
        }
      }

      // Determine phase
      let phase = "innings1";
      const mStatus = (apiStatusStr || "").toLowerCase();
      if (currentInnings === 2) phase = "innings2";
      if (mStatus.includes("completed") || mStatus.includes("result")) phase = "ended";
      if (mStatus.includes("break") || mStatus.includes("innings break")) phase = "break";

      // Compute target — use DLS if available, otherwise innings1 + 1
      const targetRuns = currentInnings === 2
        ? (dlsTarget || inn1Score + 1)
        : null;

      await sb.from("match_live_state").update({
        innings1_score: inn1Score, innings1_wickets: inn1Wickets, innings1_overs: inn1Overs,
        innings2_score: inn2Score, innings2_wickets: inn2Wickets, innings2_overs: inn2Overs,
        current_innings: currentInnings, phase,
        target_runs: targetRuns,
        updated_at: new Date().toISOString(),
      }).eq("match_id", matchId);

      if (phase === "ended") {
        await sb.from("matches").update({ status: "ended" }).eq("id", matchId);
        await sb.from("prediction_windows")
          .update({ status: "locked", locks_at: new Date().toISOString() })
          .eq("match_id", matchId)
          .eq("status", "open");

        // Trigger overall leaderboard aggregation
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/update-overall-leaderboard`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ match_id: matchId }),
          });
          log("info", "Triggered overall leaderboard update", { match_id: matchId });
        } catch (e: any) {
          log("error", "Failed to trigger overall leaderboard", { match_id: matchId, error: e.message });
        }
      }

      await sb.from("api_sync_state").update({
        last_innings1_score: inn1Score, last_innings1_wickets: inn1Wickets,
        last_innings1_overs: inn1Overs, last_innings2_score: inn2Score,
        last_innings2_wickets: inn2Wickets, last_innings2_overs: inn2Overs,
        last_synced_at: new Date().toISOString(),
      }).eq("match_id", matchId);

      results.push({
        match_id: matchId, status: "synced", new_deliveries: newDeliveries,
        auto_activated: matchStatus === "registrations_open" && apiIsLive,
        score: `${inn1Score}/${inn1Wickets} (${inn1Overs}ov)${currentInnings === 2 ? ` | ${inn2Score}/${inn2Wickets} (${inn2Overs}ov)` : ""}`,
      });
    } catch (e: any) {
      log("error", "Sync error", { match_id: matchId, error: e.message });
      results.push({ match_id: matchId, status: "error", reason: e.message });
    }
  }

  // AI-adaptive polling interval with 2s timeout
  try {
    recommendedInterval = await analyzeGamePace(sb, results);
  } catch (e: any) {
    log("warn", "AI pace analysis failed, using default 15s", { error: e.message });
  }

  return { synced: results.length, results, recommended_interval: recommendedInterval };
}

// ── Analyze game pace with Gemini (2s timeout) ──────────────────────
async function analyzeGamePace(sb: any, syncResults: any[]): Promise<number> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return 15;

  const activeSyncs = syncResults.filter((r: any) => r.status === "synced");
  if (activeSyncs.length === 0) return 15;

  const matchId = activeSyncs[0].match_id;

  const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

  const [del2m, del5m, liveState] = await Promise.all([
    sb.from("deliveries").select("id", { count: "exact", head: true })
      .eq("match_id", matchId).gte("created_at", twoMinAgo),
    sb.from("deliveries").select("id", { count: "exact", head: true })
      .eq("match_id", matchId).gte("created_at", fiveMinAgo),
    sb.from("match_live_state").select("*").eq("match_id", matchId).single(),
  ]);

  const stateData = liveState.data;
  if (!stateData) return 15;

  const currentInnings = stateData.current_innings || 1;
  const score = currentInnings === 1 ? stateData.innings1_score : stateData.innings2_score;
  const wickets = currentInnings === 1 ? stateData.innings1_wickets : stateData.innings2_wickets;
  const overs = currentInnings === 1 ? stateData.innings1_overs : stateData.innings2_overs;
  const target = stateData.target_runs;
  const phase = stateData.phase;

  const prompt = `You are a cricket match pace analyzer. Given the current match state, return ONLY a JSON object with "interval" (integer 10-20) and "reason" (short string).

Match state:
- Phase: ${phase}
- Innings: ${currentInnings}
- Score: ${score}/${wickets} (${overs} overs)
- Target: ${target || "N/A"}
- Deliveries in last 2 min: ${del2m.count || 0}
- Deliveries in last 5 min: ${del5m.count || 0}
- New deliveries this sync: ${activeSyncs[0].new_deliveries || 0}

Rules:
- 10s: Death overs (17-20) with high required rate, wicket just fell, tight chase
- 12s: Powerplay (1-6), regular active play with frequent deliveries
- 15s: Mid-innings steady play
- 20s: Breaks, very slow over rate, no new deliveries recently

Return ONLY valid JSON like: {"interval": 12, "reason": "powerplay active play"}`;

  try {
    // 2-second timeout for Gemini
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      log("warn", "Gemini API error", { status: res.status });
      await res.text(); // consume body
      return 15;
    }

    const body = await res.json();
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const interval = Math.min(20, Math.max(10, parseInt(parsed.interval) || 15));
      log("info", "AI pace recommendation", { interval, reason: parsed.reason });
      return interval;
    }
  } catch (e: any) {
    if (e.name === "AbortError") {
      log("warn", "Gemini timed out (2s), using default 15s");
    } else {
      log("warn", "Gemini parse error", { error: e.message });
    }
  }

  return 15;
}

// ── Score predictions for a resolved window ──────────────────────────
async function scorePredictions(sb: any, matchId: string, windowId: string, correctKey: string) {
  try {
    // Idempotency check: skip if already scored
    const { data: windowRow } = await sb
      .from("prediction_windows")
      .select("scored_at")
      .eq("id", windowId)
      .single();

    if (windowRow?.scored_at) {
      log("info", "Window already scored, skipping", { window_id: windowId });
      return;
    }

    const { data: config } = await sb
      .from("match_scoring_config")
      .select("*")
      .eq("match_id", matchId)
      .single();

    const pointsPerCorrect = config?.points_per_correct || 10;

    const { data: predictions } = await sb
      .from("predictions")
      .select("id, mobile, player_name, prediction")
      .eq("window_id", windowId);

    if (!predictions || predictions.length === 0) {
      // Mark as scored even with no predictions
      await sb.from("prediction_windows").update({ scored_at: new Date().toISOString() }).eq("id", windowId);
      return;
    }

    // Single pass: score each prediction and update leaderboard atomically per player
    for (const pred of predictions) {
      const predKey = pred.prediction?.key || pred.prediction;
      const isCorrect = predKey === correctKey;
      const points = isCorrect ? pointsPerCorrect : 0;

      await sb.from("predictions").update({
        is_correct: isCorrect,
        points_earned: points,
      }).eq("id", pred.id);

      // Upsert leaderboard: update both total_predictions AND correct_predictions in one pass
      const { data: existing } = await sb
        .from("leaderboard")
        .select("id, total_points, correct_predictions, total_predictions")
        .eq("match_id", matchId)
        .eq("mobile", pred.mobile)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        await sb.from("leaderboard").update({
          total_points: (existing.total_points || 0) + points,
          correct_predictions: (existing.correct_predictions || 0) + (isCorrect ? 1 : 0),
          total_predictions: (existing.total_predictions || 0) + 1,
          last_correct_at: isCorrect ? now : undefined,
          last_updated: now,
        }).eq("id", existing.id);
      } else {
        await sb.from("leaderboard").insert({
          match_id: matchId,
          mobile: pred.mobile,
          player_name: pred.player_name,
          total_points: points,
          correct_predictions: isCorrect ? 1 : 0,
          total_predictions: 1,
          last_correct_at: isCorrect ? now : null,
        });
      }
    }

    // Mark window as scored
    await sb.from("prediction_windows").update({ scored_at: new Date().toISOString() }).eq("id", windowId);

    // Recompute ranks
    const { data: allEntries } = await sb
      .from("leaderboard")
      .select("id, total_points, correct_predictions, last_correct_at")
      .eq("match_id", matchId)
      .order("total_points", { ascending: false })
      .order("correct_predictions", { ascending: false })
      .order("last_correct_at", { ascending: true });

    if (allEntries) {
      for (let i = 0; i < allEntries.length; i++) {
        await sb.from("leaderboard").update({ rank_position: i + 1 }).eq("id", allEntries[i].id);
      }
    }
  } catch (e: any) {
    log("error", "scorePredictions error", { window_id: windowId, error: e.message });
  }
}

// ── RE-DISCOVER ─────────────────────────────────────────────────────
async function rediscoverMatchId(sb: any, projectKey: string, headers: any, matchId: string): Promise<string | null> {
  try {
    const { data: match } = await sb.from("matches").select("name").eq("id", matchId).single();
    if (!match?.name) return null;

    const matchNameLower = match.name.toLowerCase();
    log("info", "Re-discovering match", { match_name: match.name });

    const res = await fetchWithRetry(
      `${ROANUZ_BASE}/${projectKey}/tournament/${IPL_TOURNAMENT_KEY}/fixtures/`,
      { headers }
    );
    const body = await res.json();
    const fixtures = body.data?.matches || [];

    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 3600 * 1000;
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istMidnight = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
    const todayStartUTC = new Date(istMidnight.getTime() - IST_OFFSET_MS);
    const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 3600 * 1000 - 1);

    for (const m of fixtures) {
      const startTime = m.start_at ? new Date(m.start_at * 1000) : null;
      if (!startTime) continue;
      if (startTime.getTime() < todayStartUTC.getTime() - 6 * 3600 * 1000 || startTime.getTime() > todayEndUTC.getTime()) continue;

      const teams = m.teams || {};
      const teamNames = Object.values(teams).map((t: any) => (t.name || "").toLowerCase());
      const fixtureNameLower = (m.name || "").toLowerCase();

      const matchesByName = teamNames.some((tn: string) => {
        const words = tn.split(" ");
        return words.some((w: string) => w.length > 3 && matchNameLower.includes(w));
      });

      const matchesByFixtureName = fixtureNameLower.includes("vs") && matchNameLower.includes("vs") &&
        fixtureNameLower.split("vs").some((part: string) => matchNameLower.includes(part.trim().split(" ")[0]));

      if (matchesByName || matchesByFixtureName) {
        const statusStr = m.status_str || m.status || "";
        const sLower = statusStr.toLowerCase();
        if (!sLower.includes("completed") && !sLower.includes("result")) {
          log("info", "Re-discovered match", { ext_id: m.key, status: statusStr, match_name: match.name });
          return m.key;
        }
      }
    }

    log("info", "Re-discovery found no better match", { match_name: match.name });
    return null;
  } catch (e: any) {
    log("error", "rediscoverMatchId error", { error: e.message });
    return null;
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
