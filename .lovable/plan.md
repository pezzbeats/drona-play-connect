

## Problem

The RR vs CSK match is live on TV but the app is stuck on "Pre-Match". The sync response confirms: `"reason":"not live yet per API"` for all 3 matches.

The root cause is the `isApiStatusLive()` function in `cricket-api-sync` — it only checks for `"live"`, `"in progress"`, and `"in_progress"` in the `status_str` field. The Roanuz Cricket API v5 likely returns different status strings (e.g., `"started"`, `"play"`, `"1st innings"`, `"2nd innings"`, `"innings break"`, `"stumps"`) that aren't being matched.

Additionally, the function only reads `matchData.status_str` but Roanuz v5 may use `matchData.status` (a structured object) or `matchData.status_overview` instead.

## Solution

### 1. Fix `isApiStatusLive()` in `cricket-api-sync/index.ts`

Broaden the live-detection logic to cover all Roanuz status variations:

```ts
function isApiStatusLive(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase();
  return (
    s.includes("live") ||
    s.includes("in progress") ||
    s.includes("in_progress") ||
    s.includes("started") ||
    s.includes("play") ||
    s.includes("innings") ||
    s.includes("stumps") ||
    s.includes("break")
  );
}
```

### 2. Add fallback status detection from multiple API fields

In `doSync`, also check `matchData.status` (which may be a string like `"started"`) and `matchData.play_status` as fallbacks, not just `matchData.status_str`. Log the actual value so we can debug in production:

```ts
const apiStatusStr = matchData.status_str || matchData.status || "";
console.log(`Match ${matchId} API status_str: "${apiStatusStr}"`);
const apiIsLive = isApiStatusLive(apiStatusStr);
```

Also check if `matchData.innings` has data — if innings data exists, the match is definitely live regardless of status string