
## Permanent fix plan

### What is actually broken right now
The screenshot points to a new hard failure in the backend sync function, not just a slow live feed:

- the UI message `isDegraded is not defined` is coming from the live sync function response
- in `supabase/functions/cricket-api-sync/index.ts`, `isDegraded` is declared inside the `if (bbbBody.data)` block but used later in `results.push(...)`
- if that block does not define it in scope, the function throws, so the client keeps retrying but never gets a valid sync result
- that makes the app look like it “polls once and freezes”, even if retries are still happening

There may still be parser issues after that, but this runtime crash must be removed first.

## Fix approach

### 1) Remove the runtime crash in `cricket-api-sync`
Refactor the sync result variables so they are declared before the ball-by-ball block and always exist:

- hoist `isDegraded`
- hoist any related diagnostic values used in the final `results.push`
- initialize safe defaults before parsing starts

This ensures the function never crashes because a parser branch was skipped.

### 2) Make sync result generation safe even when ball-by-ball payload is missing or malformed
Update the function so it always returns a valid result object:

- `new_deliveries` defaults to `0`
- `degraded` defaults to `false`
- if score advances but deliveries cannot be parsed, set:
  - `degraded: true`
  - stable `degraded_message`
  - parser/debug metadata

This prevents “ReferenceError” style failures from ever blocking live updates again.

### 3) Separate “last attempt” from “last success” in the polling hook
Right now the UI mostly reflects successful syncs. If retries fail, it can look dead.

Update `src/hooks/useLiveMatchSync.ts` to track both:
- `lastAttemptAt`
- `lastSyncAt` (success only)

Then use that in the live UI so users can see:
- the app is still retrying
- whether the issue is backend failure vs no new ball

### 4) Keep the UI in a controlled degraded state instead of a broken one
Update `PredictionPanel` and `Scoreboard` so backend sync failures show a stable fallback state:

- “Live feed error — reconnecting”
- “Retrying automatically”
- optional “Last retry Xs ago”

The key change is that the UI should never surface raw failure caused by a coding bug again.

### 5) Finish hardening the delivery parser after the crash is removed
Once the hard crash is fixed, keep the parser improvements focused on delivery ingestion:

- support array and object-map ball structures
- support alternate ball number keys
- avoid collapsing unknown deliveries to `1`
- log compact payload-shape diagnostics when score changes but deliveries remain `0`

This addresses the original “Waiting for next ball forever” problem after the current crash is gone.

### 6) Add regression protection so this does not come back
Add tests for:
- sync result can be returned even when BBB data is absent
- degraded metadata is still defined safely
- page polling continues after repeated backend errors
- prediction UI shows retry state without crashing
- alternate ball identity fields still parse correctly

## Files to update
- `supabase/functions/cricket-api-sync/index.ts`
- `src/hooks/useLiveMatchSync.ts`
- `src/components/live/PredictionPanel.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/test/cricket-sync-parsing.test.ts`
- `src/test/live-sync-tab-persistence.test.tsx`
- `src/components/live/__tests__/PredictionPanel.test.tsx`

## Expected outcome
After this fix:
- the `isDegraded is not defined` failure will be eliminated
- live sync will keep returning valid responses instead of crashing
- the app will visibly keep retrying even during backend/API problems
- once retries succeed, deliveries and next-ball windows can resume normally
- future parser failures will degrade gracefully instead of breaking the live game
