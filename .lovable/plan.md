
## What’s actually still broken

The tab-level polling fix is already in place, so this is no longer a “Guess tab unmounts the sync engine” problem.

The new evidence shows the real blocker is deeper:

- `cricket-api-sync` is being called repeatedly and successfully
- match score is advancing in backend responses:
  - `134/2 (12.5)`
  - `135/2 (13.1)`
  - `135/3 (13.2)`
  - `136/3 (13.3)`
- but every sync still returns:
  - `new_deliveries: 0`
- so no fresh `deliveries` are inserted
- which means no `prediction_windows` get opened
- so the UI stays stuck on “Waiting for Next Ball”

In short: realtime polling is alive now, but the ball-by-ball ingestion is still failing.

## Root cause likely causing the permanent freeze

### 1) The parser is still too narrow for the current provider payload
In `cricket-api-sync`, the normalizer currently assumes balls come from:
- `data.overs`
- `data.over_groups`
- `data.innings[*].overs`
- `data.innings[*].over_groups`

But the logs show score changes with zero deliveries parsed, which strongly suggests the provider’s live payload shape for this match does not match the current extraction logic closely enough.

### 2) Ball identity is probably being derived incorrectly
Current dedupe depends on:

```text
ballNo = ball.ball_number || ball.ball || 1
dedupeKey = innings-over-ball
```

If the provider uses a different field such as:
- `number`
- `index`
- `delivery_number`
- nested `ball.number`
- string keys from an object map

then multiple real deliveries can collapse to the same fallback key and be skipped.

### 3) The frontend still has no real “degraded sync” state
`Live.tsx` creates `syncState`, but it is not actually passed into:
- `PredictionPanel`
- `Scoreboard`

So the app knows whether sync is stale, but the Guess screen does not use that information to explain the failure or trigger stronger recovery behavior.

## Permanent fix plan

### 1) Harden `cricket-api-sync` around real payload shapes, not just current assumptions
Refactor the ball-by-ball section into explicit helpers inside `supabase/functions/cricket-api-sync/index.ts`:

- `extractInningsCollections(bbbBody, currentInnings)`
- `extractOversFromInnings(inningsNode)`
- `extractBallsFromOver(overNode)`
- `resolveBallIdentity(ball, overNo, fallbackIndex)`
- `normalizeDelivery(ball, innNo, overNo, ballNo)`

This should support:
- arrays and objects
- overs keyed by strings
- balls keyed by strings
- nested delivery objects
- alternate numbering fields

### 2) Stop defaulting every unknown ball to `1`
This is the most dangerous current behavior.

Change ball numbering logic so it:
- tries all known candidate fields first
- falls back to iteration index within the over
- never silently reuses `1` for all unknown balls

Example target behavior:

```text
ballNo candidates:
ball.ball_number
ball.ball
ball.number
ball.delivery_number
ball.sequence
loop index + 1
```

That alone can fix false dedupe and unlock delivery creation.

### 3) Add observability for parsed overs and parsed balls
Right now logs confirm score movement, but not enough about parser output.

Add structured logs for each sync:
- innings discovered
- overs discovered per innings
- balls discovered per innings
- normalized deliveries produced
- deliveries skipped due to dedupe
- windows opened / resolved

Also log a compact sample of the first parsed ball shape when zero deliveries are produced during a score change.

That will make future feed-shape regressions diagnosable instead of invisible.

### 4) Add a degraded fallback when score/balls advance but parsed deliveries stay zero
When score advances but no delivery is inserted:
- mark sync result as degraded
- return metadata such as:
  - `degraded: true`
  - `reason: "score_advanced_without_deliveries"`
  - `score_changed: true`

Optionally, if innings balls increased but parser still fails:
- create/update `match_live_state.last_delivery_summary` with a sync warning for operators
- avoid opening fake windows unless there is enough delivery identity to resolve them correctly

Important: do not fabricate prediction windows without a trustworthy delivery boundary.

### 5) Use sync health in the UI
`Live.tsx` already has `syncState`, but it is unused.

Pass sync health props down to:
- `Scoreboard`
- `PredictionPanel`

New prop shape can be minimal:

```text
{
  syncing,
  lastSyncAt,
  lastSyncError,
  isStale
}
```

Then update the Guess screen states:
- `Syncing live feed…`
- `Waiting for next ball…`
- `Live feed delayed — retrying`
- `Live feed error — reconnecting`

Rule:
- if there are no open windows and `syncState.isStale === true`, do not show normal waiting copy
- show delayed/degraded copy instead

### 6) Strengthen `PredictionPanel` fallback polling behavior
Current fallback polling exists, but it only refetches tables. That won’t help if backend ingestion is broken.

Plan:
- keep DB polling
- if no open window and sync is stale, surface stronger retry messaging
- optionally trigger a guarded lightweight refresh indicator based on page-level sync freshness rather than websocket state alone

This prevents the user from seeing a misleading “next window will open automatically” message when the feed is actually degraded.

### 7) Surface sync health on the Score tab too
`Scoreboard` should show a small status badge:
- Live feed healthy
- Syncing…
- Feed delayed

That gives admins/users immediate visibility that the issue is backend ingestion, not just “no ball yet”.

### 8) Add targeted tests for this exact regression
Add tests for:

#### `src/test/cricket-sync-parsing.test.ts`
- parses overs when stored as object maps
- parses balls when stored as object maps
- resolves `ballNo` from alternate field names
- falls back to loop index when numbering is missing
- does not collapse multiple balls to `ballNo = 1`
- flags degraded state when score advances but normalized deliveries are zero

#### new UI test
`src/components/live/__tests__/PredictionPanel.test.tsx`
- shows “Live feed delayed” when there are no windows and sync is stale
- shows normal waiting state only when feed is healthy

#### new integration test
`src/test/live-sync-tab-persistence.test.tsx`
- tab switching keeps sync hook mounted
- stale sync state reaches PredictionPanel

## Files to update

- `supabase/functions/cricket-api-sync/index.ts`
- `src/pages/Live.tsx`
- `src/components/live/PredictionPanel.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/components/live/__tests__/PredictionPanel.test.tsx`
- `src/test/cricket-sync-parsing.test.ts`
- `src/test/live-sync-tab-persistence.test.tsx`

## Technical details

```text
Current state
Live page polling works
        |
        v
cricket-api-sync runs every ~15s
        |
        v
score updates from match API
        |
        v
ball-by-ball parser yields 0 deliveries
        |
        v
no prediction windows created
        |
        v
Guess screen waits forever

Target state
Live page polling works
        |
        v
cricket-api-sync parses live BBB payload robustly
        |
        v
new deliveries inserted with stable identities
        |
        v
old window resolved + next window opened
        |
        v
Guess screen updates automatically
```

## Expected outcome

After this fix:
- the app will stop getting stuck at “Waiting for Next Ball” during live score movement
- new deliveries will be created reliably from current provider payloads
- prediction windows will resume opening automatically
- the UI will clearly distinguish a true pause between balls from a degraded sync condition
- future payload-shape changes will be much easier to detect and debug
