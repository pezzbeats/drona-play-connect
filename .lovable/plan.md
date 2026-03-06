
## Analysis of Current Cricket Engine Bugs

### `record-delivery/index.ts` — Critical bugs found:

1. **`ballNo` is wrong for illegal deliveries (line 58):** `const ballNo = isIllegal ? legalBallCount + 1 : legalBallCount + 1;` — both branches are identical. For a wide/no-ball, `ball_no` should stay at the NEXT legal ball position (i.e., `legalBallCount + 1`), but for legal deliveries it should be `legalBallCount + 1`. The formula is correct by accident but misleading — the real issue is in the over completion check below.

2. **Over auto-completes itself (lines 148-155):** When 6 legal balls are bowled, the function auto-marks the over as `complete`. This means the admin **cannot** record a 7th delivery (wide/no-ball on ball 6) because the over closes immediately. Per cricket rules: the over only closes after the 6th *legal* ball is confirmed, but **an illegal delivery on what would be ball 6 should still be allowed**. The check needs to be: only auto-complete if the 6th legal ball was NOT an illegal delivery. Actually, the correct behaviour: the over completes at exactly 6 legal balls — if ball 6 is a no-ball/wide, the over is NOT complete.

3. **Overs display is wrong (lines 104-113):** `completedOversCount` counts completed overs (before this delivery), then adds `remainingBalls / 10` (e.g., 3 balls in current over = 0.3). But it uses `allOvers?.length` which counts ALL completed overs — after auto-completing the over, this will include the just-completed one, double-counting. The correct formula: `completedOversCount` should NOT include the current over, then `newLegalBalls % 6` is the partial count.

4. **Strike rotation is not implemented:** After recording a delivery, there is no strike rotation logic. Odd runs = striker and non-striker swap. End of over = striker and non-striker swap. This needs to be added to the live state update.

5. **Over inactive guard is missing:** Nothing prevents recording a delivery if `over_id` is null or the over is not `active` status. Need to fetch and validate the over status before insert.

6. **Wicket: no incoming batsman selection:** After a wicket, `current_striker_id` (or non-striker) is set to `null`. The admin then has no UI to set the incoming batsman — they need to set it before the next delivery.

7. **Innings end: no prediction lock, no field reset:** When transitioning to `break` or `innings2`, open prediction windows should auto-lock, and current player IDs should be cleared on the live state.

### `match-control/index.ts` — Gaps:

8. **Innings transition missing field resets (lines 67-75):** When setting phase to `innings2`, it swaps batting/bowling teams and sets `current_innings = 2`, but does NOT clear: `current_striker_id`, `current_non_striker_id`, `current_bowler_id`. These carry over from innings 1.

9. **Innings break missing prediction lock:** No auto-lock of open/locked windows when phase changes to `break` or `ended`.

### `AdminControl.tsx` — UI gaps:

10. **After recording delivery, form resets only manually:** After a wicket or over completion, the admin needs to select the incoming batsman. The form should prompt for this.

11. **No over inactive guard in UI:** `handleRecordDelivery` fires even if `activeOver` is null or the over is already complete. The "Record Delivery" button should be disabled if no active over.

12. **No strike rotation override toggle:** No UI to manually override who is striker/non-striker.

13. **`auto_rotate_strike` flag for the delivery form:** Add a checkbox "Auto-rotate strike" (default true) that the admin can uncheck for edge cases (e.g. run-out where striker doesn't rotate, overthrows, etc.).

---

## Plan

### Part 1 — `record-delivery/index.ts` — Rewrite scoring logic

**Fixes:**
- **Guard: validate over is active** — fetch over from DB before anything else; return 409 if `status !== 'active'`.
- **Fix ball_no assignment** — legal: `legalBallCount + 1`; illegal: same position (doesn't consume a ball slot, but delivery_no still increments).
- **Fix overs display** — count completed overs (status=complete, excluding current), then add partial: `(newLegalBalls % 6) / 10`.
- **Over auto-complete fix** — after recording, if `newLegalBallsTotal >= 6` AND the current delivery is legal, mark over complete. If it's an illegal delivery and we're at 6+ legal balls, that's impossible (the over would already have been complete after the previous delivery). So the logic stays the same but the display calc is corrected.
- **Strike rotation** — after recording delivery:
  - If `auto_rotate` is true (sent from client, default `true`):
    - Runs are **odd**: swap `current_striker_id` ↔ `current_non_striker_id`
    - End of over (6th legal ball): swap striker/non-striker (batsmen cross for end-of-over)
    - Wicket: null the out batsman (existing logic); no rotation on wicket

- **Wicket clearing** — already sets player to null; add a field `needs_new_batsman: true` in response so UI can prompt.

- **Summary string improvement** — include ball number in summary.

**New `auto_rotate` body param** (boolean, default `true`).

### Part 2 — `match-control/index.ts` — Innings transition cleanup

When `set_phase` is called with `innings2` or `break` or `ended`:
- Clear `current_striker_id`, `current_non_striker_id`, `current_bowler_id` to null
- Auto-resolve any `open` prediction windows to `locked` (stop accepting predictions but don't score them — admin will resolve manually)

```typescript
if (['innings2', 'break', 'ended'].includes(phase)) {
  updateData.current_striker_id = null;
  updateData.current_non_striker_id = null;
  updateData.current_bowler_id = null;
  
  // Lock any open windows
  await supabase
    .from('prediction_windows')
    .update({ status: 'locked' })
    .eq('match_id', match_id)
    .eq('status', 'open');
}
```

### Part 3 — `AdminControl.tsx` — UI improvements

**Over management section changes:**

1. **Block delivery recording when no active over** — "Record Delivery" button disabled, show message "Activate a new over to record deliveries".

2. **After delivery succeeds (`record-delivery` returns `needs_new_batsman: true`)** — show an inline "Select incoming batsman" prompt (a `Select` component populated with the batting team players who are not currently active). On selection, call `match-control` with `action: 'update_players'`.

3. **Strike rotation toggle** — add a small checkbox `Auto-rotate strike` (default checked) in the delivery form. When unchecked, sends `auto_rotate: false`.

4. **Batting/bowling team split for player selects** — split the `players` state into `battingPlayers` and `bowlingPlayers` based on `batting_team_id`/`bowling_team_id` from `liveState` and `match_roster`. Striker/non-striker selects show only batting team; bowler shows only bowling team.

5. **Over ball counter** — show `X / 6 legal balls` in the over header so admin knows how many balls have been bowled this over.

**Implementation detail for batting players:**
```typescript
// Already have players[] and liveState.batting_team_id / liveState.bowling_team_id
// Split based on team_id field on players (from match_roster team_id)
const battingPlayers = players.filter(p => p.team_id === liveState?.batting_team_id);
const bowlingPlayers = players.filter(p => p.team_id === liveState?.bowling_team_id);
```

6. **Incoming batsman prompt after wicket** — add state `needsNewBatsman` (boolean). After a successful delivery call that had `is_wicket = true`:
   - Set `needsNewBatsman = true`
   - Show a card prompting "Select incoming batsman" with batting team players minus already-active ones

---

## Files changed

| File | Change |
|---|---|
| `supabase/functions/record-delivery/index.ts` | Guard vs inactive over, fix overs display, fix ball_no, add strike rotation with `auto_rotate` param, add `needs_new_batsman` in response |
| `supabase/functions/match-control/index.ts` | On innings2/break/ended: clear player IDs, auto-lock open windows |
| `src/pages/admin/AdminControl.tsx` | Batting/bowling player split, ball counter per over, auto-rotate toggle, incoming batsman prompt after wicket, disable record-delivery when no active over |

No DB schema changes needed.
