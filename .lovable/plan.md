
## Fix Plan: Real-Time Guess Flow Is Breaking in Two Places

### What I found
- The live match is present and updating in the backend:
  - `matches`: GT vs RR is `live`
  - `game_access`: the current user has access to that match
  - `match_live_state`: scores are changing
- But the core gameplay pipeline is broken:
  - `deliveries`: no rows for the live match
  - `prediction_windows`: no rows for the live match
- That means the app is not actually “stuck” in the UI first. The backend is not producing ball-by-ball events/windows reliably.
- There is also a frontend resilience gap:
  - the Guess screen depends mostly on realtime updates after initial load
  - when websocket state is reconnecting, users can remain on “No Active Fun Guess” even if data appears later
- I also found a likely parsing bug:
  - `match_live_state.current_innings` is showing `2` while innings 1 score is still moving
  - so the innings detection in `cricket-api-sync` is too naive for the current API payload

### Root causes to fix
1. **`cricket-api-sync` ball-by-ball parser is too narrow**
   - it assumes `bbbBody.data.overs || bbbBody.data.over_groups`
   - if the provider returns a different live shape, no deliveries are produced and no windows open

2. **Current innings detection is incorrect**
   - it switches to innings 2 based on weak heuristics
   - this can misclassify live state and break delivery handling

3. **Guess UI lacks a strong fallback when realtime is degraded**
   - it shows a reconnecting banner, but does not aggressively self-heal the Guess data feed

4. **The empty-state copy is misleading**
   - it says “Admin will open the next guess window shortly”
   - but this match flow is automated, so the message should reflect sync status instead

---

## Implementation plan

### 1) Harden the sync engine
**File:** `supabase/functions/cricket-api-sync/index.ts`

I’ll refactor the live sync logic so it can reliably extract deliveries from multiple API shapes and stop silently doing nothing.

Changes:
- Add a **ball-by-ball normalizer** that can read:
  - `data.overs`
  - `data.over_groups`
  - innings-grouped structures if present
  - array or object variants
- Add a **safe innings resolver** that prefers explicit innings metadata from the API, then falls back to score/balls evidence instead of the current overs-only shortcut
- Add stronger logging:
  - raw payload shape summary
  - parsed innings count
  - parsed ball count
  - delivery insert count
  - window open/resolve actions
- Add a **no-silent-failure guard**:
  - if score/balls advance but parsed balls are zero, log a warning and keep retrying instead of pretending sync succeeded
- Keep the existing automation:
  - auto-lock open window before delivery
  - score predictions
  - auto-open next window
  - match lifecycle handling

### 2) Make delivery ingestion idempotent and safer
**Files:** `supabase/functions/cricket-api-sync/index.ts` + migration if needed

Changes:
- Stop relying only on `existingCount` + `slice(...)` as the main dedupe strategy
- Match balls using stable delivery identity where possible:
  - innings number
  - over number
  - ball number
- If needed, add a DB uniqueness guard on deliveries for production safety:
```text
(match_id, innings_no, over_no, ball_no)
```
This prevents duplicate inserts during retries/reconnects.

### 3) Fix the Guess screen so it self-recovers even if realtime is shaky
**File:** `src/components/live/PredictionPanel.tsx`

Changes:
- Capture `connected` / `reconnecting` from `useRealtimeChannel`
- Add a **fallback polling loop** while:
  - realtime is disconnected/reconnecting, or
  - the match is live but there is no open window yet
- Poll lightweight reads for:
  - latest `prediction_windows`
  - `match_flags`
  - the user’s own prediction/score state
- Replace the current empty-state behavior with smarter states:
  - “Syncing live guesses…”
  - “Waiting for next ball…”
  - “Guesses paused by admin”
- Keep optimistic submission behavior unchanged

### 4) Improve live match shell feedback
**Files:** `src/pages/Live.tsx`, possibly `src/hooks/useRealtimeChannel.ts`

Changes:
- Keep the banner, but make the app less dependent on websocket health for correctness
- Optionally extend the shared realtime hook to support a built-in fallback refetch cadence while reconnecting
- Ensure the live experience remains usable even when realtime briefly drops

### 5) Align the Scoreboard with the fixed sync model
**File:** `src/components/live/Scoreboard.tsx`

Changes:
- Use the corrected innings detection coming from backend updates
- Keep polling `cricket-api-sync`, but avoid presenting a misleading innings state if API data is partial
- Surface a clearer “syncing live feed” state if the backend has not yet produced deliveries for the current phase

### 6) Add tests for the exact failure mode
**Files:** `src/test/cricket-sync-parsing.test.ts` and new targeted tests if needed

Add tests for:
- ball-by-ball payload variants
- innings-shell payload where innings 2 exists structurally but is not actually active
- delivery normalization
- dedupe/idempotent insert logic
- “score advancing but zero parsed balls” guard
- prediction window auto-open after a parsed delivery
- frontend Guess fallback behavior when realtime is disconnected

---

## Expected outcome
After this fix:
- live matches will continue syncing even if the provider payload shape changes slightly
- innings state will stay correct
- deliveries will be written reliably
- prediction windows will open/lock/resolve automatically again
- users will still see fresh Guess data even during websocket reconnects
- the app will no longer sit on a false “No Active Fun Guess” state while the match is live

## Files likely affected
- `supabase/functions/cricket-api-sync/index.ts`
- `src/components/live/PredictionPanel.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/hooks/useRealtimeChannel.ts` (optional resilience upgrade)
- `src/pages/Live.tsx`
- `src/test/cricket-sync-parsing.test.ts`
- migration file only if I add a deliveries uniqueness/index hardening step

## Technical notes
- No auth flow change is needed
- No role/policy redesign is needed for this fix
- The main issue is sync correctness + frontend fallback resilience
- I will preserve the existing admin manual command-center workflow while fixing the automated live-match flow
