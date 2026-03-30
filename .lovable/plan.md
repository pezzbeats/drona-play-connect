

## Problem

Three issues identified from the logs:

### 1. Wrong External Match ID
The RR vs CSK match (`fa4fd1a8`) is linked to external ID `a-rz--cricket--hC2031799080170184707`, but the Roanuz API returns `"completed"` for it. This is likely pointing to an **old/wrong match** — not today's live game. Score shows `0/0 (0ov)` because the match data response has no innings data (`hasInnings: undefined`), and since the status is "completed", the sync skips score updates.

The discover function only runs once per match and stores the external ID. If the wrong ID was mapped initially, it never self-corrects.

### 2. Gemini API 404
The model name `gemini-2.0-flash-lite` returns 404. This is not a valid model in the Gemini API. Need to use `gemini-2.0-flash` or `gemini-1.5-flash`.

### 3. Prediction Game Not Working
Since scores aren't syncing (wrong external match ID → "completed" status), no new deliveries are recorded, so no prediction windows are being opened automatically.

## Solution

### File 1: `supabase/functions/cricket-api-sync/index.ts`

**A. Add debug logging of full API response structure** to diagnose the external match ID issue:
```ts
// After fetching match data, log the key fields
console.log(`Match ${matchId} ext=${extId} raw keys: ${Object.keys(matchData).join(',')}`);
console.log(`Match ${matchId} status_str=${matchData.status_str}, status=${matchData.status}, play_status=${matchData.play_status}`);
```

**B. Add auto-re-discover logic**: When a match has status `live` in our DB but the API says `completed` and the score is 0/0, the external ID is wrong. Add a fallback that re-fetches today's fixtures and finds the correct match by team names:
```ts
// If our match is "live" but API says "completed" with no score data, 
// the external_match_id is likely wrong — attempt re-discovery
if (matchStatus === "live" && !apiIsLive && inn1Score === 0 && inn2Score === 0) {
  console.warn(`Match ${matchId} appears mislinked (API=${apiStatusStr}, score=0). Attempting re-discovery...`);
  const correctExtId = await rediscoverMatchId(sb, projectKey, headers, matchId);
  if (correctExtId && correctExtId !== extId) {
    // Update the sync state with the correct external ID and retry
    await sb.from("api_sync_state").update({ external_match_id: correctExtId }).eq("match_id", matchId);
    results.push({ match_id: matchId, status: "relinked", old_ext_id: extId, new_ext_id: correctExtId });
    continue; // Will pick up correct data on next sync cycle
  }
}
```

**C. New `rediscoverMatchId` function**: Fetches tournament fixtures, matches by team names against our DB match name, and returns the correct external ID.

**D. Fix Gemini model name**: Change `gemini-2.0-flash-lite` to `gemini-2.0-flash` (line 693).

**E. Improve innings detection**: The API may nest innings under `matchData.innings` or `matchData.play?.innings`. Check both:
```ts
const inningsObj = matchData.innings || matchData.play?.innings || {};
const hasInningsData = Object.keys(inningsObj).length > 0;
```

### File Summary

| File | Change |
|---|---|
| `supabase/functions/cricket-api-sync/index.ts` | Add auto-re-discovery for mislinked matches; fix Gemini model to `gemini-2.0-flash`; check `matchData.play?.innings` fallback; add debug logging |

