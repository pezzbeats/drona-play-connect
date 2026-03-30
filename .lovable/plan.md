

## Problem

The RR vs CSK match is live on TV but stuck showing "Pre-Match" because of a chicken-and-egg deadlock:

1. **Scoreboard polling only runs when phase is already `innings1`/`innings2`** (line 154 in Scoreboard.tsx)
2. **The phase only changes to `innings1` when `cricket-api-sync` runs and detects the API says "live"**
3. **No background polling exists** — the Index page only calls sync once on load if there are 0 matches
4. Result: the sync function hasn't run since the match was created (06:35 UTC), so it never detected the match went live

## Solution

### 1. Start polling from `pre` phase too (Scoreboard.tsx)

Change the `isLivePhase` check to also include `pre`. This way, when a user opens the Live page for a pre-match game, the Scoreboard will poll `cricket-api-sync` every 20s, which will detect the API status change and auto-activate the match.

**File**: `src/components/live/Scoreboard.tsx` line 154

Change:
```ts
const isLivePhase = state?.phase === 'innings1' || state?.phase === 'innings2' || state?.phase === 'break' || state?.phase === 'super_over';
```
To:
```ts
const isLivePhase = state?.phase === 'pre' || state?.phase === 'innings1' || state?.phase === 'innings2' || state?.phase === 'break' || state?.phase === 'super_over';
```

Use a longer interval (60s) for `pre` phase to avoid unnecessary API calls, then switch to the adaptive 20s once live.

### 2. Add periodic sync on the landing page (Index.tsx)

Add a background poll every 60 seconds on the Index page for any match with status `registrations_open` whose `start_time` is within the current window. This ensures auto-activation even if no user has opened `/live` yet.

**File**: `src/pages/Index.tsx`

Add a `useEffect` that polls `cricket-api-sync` every 60s while any match has `start_time` within 1 hour of now and status is `registrations_open`.

### 3. Immediate sync trigger on Live page mount

When a user navigates to `/live` with a `pre` phase match, trigger an immediate `cricket-api-sync` call (not waiting for the interval). This gets the latest state instantly.

**File**: `src/components/live/Scoreboard.tsx`

The existing `fetchData` on mount already runs. Just add a one-time sync call on mount regardless of phase.

### File Summary

| File | Change |
|---|---|
| `src/components/live/Scoreboard.tsx` | Include `pre` in polling phases; immediate sync on mount; longer interval for pre phase |
| `src/pages/Index.tsx` | Add 60s background poll for matches near start time |

