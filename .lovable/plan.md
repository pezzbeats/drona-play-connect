
## Fix plan: Guess screen is stuck because sync is owned by the wrong component

### What I found
- The biggest bug is architectural: `cricket-api-sync` is polled from `Scoreboard.tsx`.
- In `Live.tsx`, only the active tab is mounted:
  - `score` mounts `Scoreboard`
  - `predict` mounts `PredictionPanel`
- So when a user is on the Guess tab, `Scoreboard` unmounts and the backend sync loop stops.
- `PredictionPanel` only polls database tables (`prediction_windows`, `match_flags`, leaderboard). It does not keep the live match sync running.
- Result: the UI can sit forever on “Waiting for Next Ball” because no new windows are being produced while the user is on the Guess tab.
- Edge logs also show score updates and innings resolution, but no clear evidence that ball-by-ball parsing is consistently producing deliveries/windows. So there is a second reliability gap in `cricket-api-sync`.

## Implementation
### 1) Move match sync to a page-level hook that never unmounts
Create a shared hook, e.g. `src/hooks/useLiveMatchSync.ts`, and use it from `src/pages/Live.tsx`.

This hook will:
- invoke `cricket-api-sync` immediately on page load
- keep polling using the returned `recommended_interval`
- stay active regardless of which tab is open
- stop or slow down when the match is ended
- expose:
  - `syncing`
  - `lastSyncAt`
  - `lastSyncError`
  - `recommendedInterval`
  - `isStale`

This is the permanent fix for “works on Score tab, freezes on Guess tab”.

### 2) Make `Scoreboard` display data only, not own the sync engine
Refactor `src/components/live/Scoreboard.tsx` to:
- remove the direct `cricket-api-sync` polling responsibility
- keep realtime + data fetch logic for rendering only
- optionally receive sync freshness from `Live.tsx` to show:
  - “Live feed syncing”
  - “Live feed delayed”

This separates rendering from orchestration.

### 3) Upgrade `PredictionPanel` so it can self-heal
Update `src/components/live/PredictionPanel.tsx` to consume page-level sync state and improve fallback behavior.

Changes:
- if realtime is reconnecting or feed is stale, show a stronger syncing state
- if there is no open window for too long during a live phase, trigger a guarded refresh path
- distinguish these states:
  - `Syncing live feed…`
  - `Waiting for next ball…`
  - `Live feed delayed — retrying`
  - `Guesses paused by admin`

Also keep the current optimistic submission flow.

### 4) Harden `cricket-api-sync` where windows are created
Update `supabase/functions/cricket-api-sync/index.ts` to make delivery/window creation more observable and reliable.

Changes:
- extract the ball-by-ball normalization into a pure helper
- log:
  - parsed innings count
  - parsed over count
  - parsed ball count
  - inserted delivery count
  - opened/resolved window count
- if score changes but zero new deliveries are parsed:
  - mark the sync result as degraded
  - keep retrying on next cycle
  - return enough metadata for the UI/admin tools to detect the issue
- ensure duplicate retries do not open duplicate windows

### 5) Reduce non-essential sync noise
Edge logs show repeated `Gemini API error 404` warnings.
That should not block gameplay, but it should be isolated so live sync stays clean.

Plan:
- keep fallback interval logic
- make AI pacing fully non-blocking
- suppress or downgrade repeated 404 noise so it does not mask real sync problems

### 6) Add targeted tests for the actual failure mode
Add or extend tests to cover:
- tab switching does not stop live sync
- `PredictionPanel` recovers when realtime is degraded
- score changes with zero parsed deliveries enter degraded state
- delivery normalization from multiple payload shapes
- next-ball windows open exactly once for new deliveries

## Files likely affected
- `src/pages/Live.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/components/live/PredictionPanel.tsx`
- `src/hooks/useLiveMatchSync.ts` (new)
- `supabase/functions/cricket-api-sync/index.ts`
- `src/test/cricket-sync-parsing.test.ts`
- `src/test/live-sync-tab-persistence.test.tsx` (new)

## Technical details
```text
Current problem:
Live page
 ├─ Score tab -> Scoreboard mounted -> sync runs
 ├─ Guess tab -> Scoreboard unmounted -> sync stops
 └─ PredictionPanel only reads DB -> waits forever

Target design:
Live page
 ├─ useLiveMatchSync() always mounted
 ├─ Scoreboard reads live state
 ├─ PredictionPanel reads windows + sync freshness
 └─ tab switches do not affect backend sync
```

## Expected outcome
After this fix:
- the live match keeps syncing on every tab, not just Score
- the Guess tab refreshes without requiring the user to switch pages
- users no longer get stuck indefinitely on “Waiting for next ball”
- if the external feed degrades, the app shows a clear retry state instead of silently freezing
