

## Production Overhaul: Dual Leaderboard + Scoring Fixes + Overall Stats

This is a large but focused overhaul. Many items in the request are **already implemented** (retry logic, Gemini timeout, DLS, toss, rain delay, abandoned handling, optimistic UI, debouncing, skeleton loaders, error boundaries, structured logging). The plan covers only what's **genuinely new or broken**.

---

### What Already Exists (No Changes Needed)

- `fetchWithRetry` with exponential backoff (already in cricket-api-sync)
- Gemini 2s timeout + 15s fallback (already implemented)
- DLS target parsing, toss extraction, rain delay, abandoned match handling (all present)
- Optimistic prediction submission in PredictionPanel (already done)
- 150ms debounce in useRealtimeChannel (already done)
- Global unhandledrejection handler in main.tsx (already done)
- ErrorBoundary with structured logging (already done)
- game_access RLS tightened (already migrated)
- Unit tests for deliveryToOutcomeKey (already exist)

---

### Phase 1: Database — New Tables + Indexes

**Migration: Create `leaderboard_match_history` and `leaderboard_overall` tables**

```text
leaderboard_match_history
  id, match_id, mobile, player_name, final_rank, final_points,
  correct_predictions, total_predictions, accuracy_percentage, participated_at

leaderboard_overall
  id, mobile, player_name, total_points_overall, correct_predictions_overall,
  total_predictions_overall, matches_participated, matches_won, best_match_rank,
  rank_position_overall, last_updated, created_at
```

- RLS: Both tables readable by all, writable by authenticated
- Enable realtime on `leaderboard_overall`
- Add indexes on ranking/points columns
- Add `scored_at` timestamp column to `prediction_windows` for idempotent scoring

### Phase 2: Edge Function — `update-overall-leaderboard`

**New file: `supabase/functions/update-overall-leaderboard/index.ts`**

Triggered when a match ends. Logic:
1. Fetch all entries from `leaderboard` for that match_id
2. For each player: insert into `leaderboard_match_history` with final stats
3. For each player: query ALL their `leaderboard_match_history` records, aggregate totals
4. Upsert into `leaderboard_overall` with aggregated stats
5. Recompute `rank_position_overall` for all players

### Phase 3: Auto-Trigger Overall Leaderboard on Match End

**Update `cricket-api-sync`**: When `phase === "ended"` is set, call `update-overall-leaderboard` via internal fetch.

**Update `resolve-prediction-window`**: No changes needed — it already scores correctly.

### Phase 4: Fix Scoring Bug in `scorePredictions`

The current `scorePredictions` in cricket-api-sync has a bug: it updates `total_predictions` separately from `correct_predictions`, causing double-counting. Fix by doing a single pass that updates both correct and total counts atomically per player. Also add `scored_at` idempotency check.

### Phase 5: Frontend — Overall Leaderboard Component

**New file: `src/components/live/OverallLeaderboard.tsx`**

- Fetches from `leaderboard_overall` ordered by `rank_position_overall`
- Shows top 50 players with: total points, matches played, matches won, best rank, accuracy
- Realtime subscription on `leaderboard_overall`
- "You" badge for current user
- Rank improvement animations (reuse pattern from existing Leaderboard)

### Phase 6: Integrate Overall Leaderboard into Live Page

**Update `src/pages/Live.tsx`**: Add a 4th tab "Season" that shows `OverallLeaderboard`.

### Phase 7: Admin Overall Leaderboard Page

**New file: `src/pages/admin/AdminOverallLeaderboard.tsx`**

- View all players' overall stats with search
- CSV export
- Manual point adjustments
- View player match history

**Update `src/App.tsx`**: Add route `/admin/overall-leaderboard`.
**Update `src/components/admin/AdminSidebar.tsx`**: Add nav item.

### Phase 8: Tests

**New file: `src/test/leaderboard-overall.test.ts`**
- Test aggregation logic
- Test rank computation
- Test idempotent scoring (scored_at check)

---

### File Summary

| File | Change |
|---|---|
| **Migration SQL** | Create `leaderboard_match_history`, `leaderboard_overall` tables; add `scored_at` to `prediction_windows`; indexes |
| `supabase/functions/update-overall-leaderboard/index.ts` | **New** — aggregates match results into overall leaderboard |
| `supabase/functions/cricket-api-sync/index.ts` | Fix `scorePredictions` double-counting bug; add `scored_at` idempotency; call `update-overall-leaderboard` on match end |
| `supabase/config.toml` | Add `[functions.update-overall-leaderboard]` with `verify_jwt = false` |
| `src/components/live/OverallLeaderboard.tsx` | **New** — season leaderboard component |
| `src/pages/Live.tsx` | Add "Season" tab |
| `src/pages/admin/AdminOverallLeaderboard.tsx` | **New** — admin overall leaderboard management |
| `src/App.tsx` | Add admin route |
| `src/components/admin/AdminSidebar.tsx` | Add nav item |
| `src/test/leaderboard-overall.test.ts` | **New** — tests for aggregation logic |

