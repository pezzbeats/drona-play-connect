

## Match Summary on Ended State

When users view an ended match, the Scoreboard's "ended" section currently only shows basic innings scores. We'll enhance it with a rich match summary card showing the winner, top run-scorer, and top wicket-taker.

### Data Source

All data comes from existing tables — no schema changes needed:
- **Winner**: Compare `innings1_score` vs `innings2_score` from `match_live_state`, map to team names via `match_roster` (side `home`/`away` + `is_batting_first`)
- **Top Scorer**: Aggregate `deliveries` table — `SUM(runs_off_bat)` grouped by `striker_id`, pick highest
- **Top Wicket-Taker**: Count deliveries where `is_wicket = true` grouped by `bowler_id`, pick highest

### Changes

**File: `src/components/live/Scoreboard.tsx`**

1. Add state for `matchSummary` (winner team name, top scorer name + runs, top wicket-taker name + wickets)
2. On mount (or when phase becomes `ended`), run two aggregation queries against `deliveries` table for this match:
   - Top scorer: group by `striker_id`, sum `runs_off_bat`, order desc, limit 1
   - Top wicket-taker: group by `bowler_id` where `is_wicket = true`, count, order desc, limit 1
3. Determine winner from `match_live_state` scores + `match_roster` batting order
4. Replace the sparse "ended" block (lines 442-458) with a richer card:
   - Trophy icon + "Match Ended"
   - Winner banner (team name + "won by X runs" or "won by X wickets")
   - Both innings scores side by side
   - Top Scorer chip (player name + runs)
   - Top Wicket-Taker chip (player name + wickets)
   - Super over note if applicable (existing logic preserved)

### Technical Detail

Since the `deliveries` table doesn't support aggregation via the Supabase JS client natively, we'll fetch deliveries for the match and compute aggregates client-side. For an ended match this is a one-time fetch, so performance is fine.

Winner logic:
- Get roster entries; the team with `is_batting_first = true` batted first (innings 1)
- If `innings2_score > innings1_score` → batting-second team won by `(10 - innings2_wickets)` wickets
- If `innings1_score > innings2_score` → batting-first team won by `(innings1_score - innings2_score)` runs
- If equal → tie / decided via super over

