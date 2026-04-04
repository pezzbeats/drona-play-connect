
## Fix plan: make live sync truly continuous and unblock next-ball windows

### What I found
- The problem is still split across **2 layers**, not just one:
  1. **Client polling is fragile**: `useLiveMatchSync` only keeps polling when `matchPhase` is already one of `pre | innings1 | innings2 | break | super_over`. If phase is late, null, stale, or not refreshed in time, the loop can stop or never fully establish.
  2. **Backend ingestion is still broken**: the sync function is returning `new_deliveries: 0` while scores are changing. That means the app is syncing scores, but not creating deliveries, so no new prediction windows open.

- The current backend parser is still too narrow:
  - it reads balls mainly from `overData.balls` / `overData.deliveries`
  - it still derives ball identity with `ball.ball_number || ball.ball || 1`
  - if the provider uses object maps or alternate keys, multiple deliveries collapse to the same key and get skipped

- The latest evidence matches this exactly:
  - network snapshot shows only a single visible client sync call from the page session
  - edge logs show live score moving from `177/5 (17)` to `185/5 (17.3)`
  - but the function still produces `new_deliveries: 0`

## Implementation
### 1) Rebuild the live polling hook so it cannot silently stop
Update `src/hooks/useLiveMatchSync.ts` to:
- start polling immediately when the live page mounts
- not depend on `matchPhase` being present before the loop starts
- keep a single self-scheduling timeout loop with an `inFlight` guard
- stop only on unmount or explicit `ended`
- treat missing phase as “keep polling with live fallback interval”

This removes the “poll once then freeze” class of bug.

### 2) Make the live page visibly prove polling is alive
Update `src/pages/Live.tsx`, `Scoreboard.tsx`, and `PredictionPanel.tsx` to show:
- last successful sync age
- current sync state
- delayed/error state clearly

This helps distinguish:
- real no-ball downtime
- websocket delay
- parser failure
- polling failure

### 3) Replace the ball-by-ball parser with shape-safe helpers
Refactor `supabase/functions/cricket-api-sync/index.ts` into helpers such as:
- `extractInningsCollections`
- `extractOversFromInnings`
- `extractBallsFromOver`
- `resolveBallIdentity`
- `normalizeDelivery`

The new parser should support:
- arrays and object maps
- innings grouped or flat payloads
- nested delivery wrappers
- alternate numbering fields like `number`, `sequence`, `delivery_number`, nested values, or loop index fallback

### 4) Fix delivery dedupe so real balls are not skipped
Change delivery identity so it:
- tries all candidate ball-number fields first
- falls back to over-local index
- never defaults every unknown ball to `1`

This is the most likely reason live deliveries are currently being discarded.

### 5) Return degraded sync metadata when score moves but balls do not
Enhance `cricket-api-sync` to return, per match:
- `degraded: true`
- `reason: "score_advanced_without_deliveries"`
- parser counts: innings/overs/balls normalized
- sample payload shape info for debugging

Then wire that into the UI so “Waiting for next ball” is not shown when the feed is actually failing.

### 6) Keep prediction windows strictly tied to real deliveries
Do not fabricate windows from score changes alone.
Instead:
- only resolve/open windows after a trustworthy delivery insert
- keep lock/resolve logic idempotent
- preserve fairness rules already in place

### 7) Add regression tests for the exact failure
Update tests to cover:
- polling continues even if phase starts as `null`
- tab switches do not stop the sync heartbeat
- object-map ball-by-ball payloads parse correctly
- alternate ball-number keys do not collapse deliveries
- PredictionPanel shows delayed/retrying state when sync is degraded

## Files to update
- `src/hooks/useLiveMatchSync.ts`
- `src/pages/Live.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/components/live/PredictionPanel.tsx`
- `supabase/functions/cricket-api-sync/index.ts`
- `src/test/live-sync-tab-persistence.test.tsx`
- `src/test/cricket-sync-parsing.test.ts`
- `src/components/live/__tests__/PredictionPanel.test.tsx`

## Expected outcome
After this fix:
- the live page will keep polling continuously instead of appearing to poll once
- scores and deliveries will stay in sync
- new prediction windows will open again when balls are actually bowled
- users will see a clear delayed/error state instead of a misleading permanent “Waiting for Next Ball”
