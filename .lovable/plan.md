
## Analysis

**Current state of leaderboard/points engine:**
- `resolve-prediction-window` hardcodes `const pointsPerCorrect = 10` — no per-match configuration
- No tie-breaker logic: when two players have equal `total_points`, order is arbitrary
- No `leaderboard_frozen` concept beyond `windows_locked` (which stops scoring, not display)
- No admin ability to adjust individual player points
- No CSV export
- No `per-over` scoring mode (only ball-by-ball)
- No "speed bonus" or any configurable scoring options
- Leaderboard shows up to 20 entries on fan side; no dedicated admin leaderboard management page
- Leaderboard table lacks: `tiebreaker_score`, `is_frozen`, `points_adjustment`, `last_correct_at`

**What needs building:**

1. **DB migration** — extend `leaderboard` and add `match_scoring_config` table
2. **`resolve-prediction-window`** — read scoring config, support over-mode windows, apply tie-breaker
3. **New admin page `/admin/leaderboard`** — freeze toggle, manual point adjustments, full table + CSV export
4. **Updated fan `Leaderboard.tsx`** — show accuracy %, rank movement indicator
5. **`AdminSidebar.tsx`** — add nav entry

---

## Part 1 — DB migration

**New table: `match_scoring_config`** (one row per match)
```sql
CREATE TABLE public.match_scoring_config (
  match_id uuid PRIMARY KEY REFERENCES matches(id),
  points_per_correct int NOT NULL DEFAULT 10,
  points_per_over_correct int NOT NULL DEFAULT 25,
  speed_bonus_enabled boolean NOT NULL DEFAULT false,
  speed_bonus_points int NOT NULL DEFAULT 5,       -- extra for first N correct
  speed_bonus_first_n int NOT NULL DEFAULT 10,     -- first 10 correct get bonus
  tiebreaker_mode text NOT NULL DEFAULT 'accuracy', -- 'accuracy' | 'time'
  leaderboard_frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_scoring_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoring config readable by all" ON public.match_scoring_config FOR SELECT USING (true);
CREATE POLICY "Scoring config writable by authenticated" ON public.match_scoring_config FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
```

**Extend `leaderboard` table:**
```sql
ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS tiebreaker_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_adjustment int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS last_correct_at timestamptz,
  ADD COLUMN IF NOT EXISTS rank_position int;
```

`tiebreaker_score` = accuracy ratio (correct/total as a float) stored on each resolve — used for deterministic ORDER BY when `total_points` ties. If `tiebreaker_mode = 'time'`, it stores the timestamp of last correct prediction as a unix epoch (lower = better).

---

## Part 2 — `resolve-prediction-window` edge function

**Per-window scoring config:**
- Fetch `match_scoring_config` for the match on every resolve call
- Use `points_per_correct` (ball window) or `points_per_over_correct` (over window)
- Speed bonus: if `speed_bonus_enabled`, for each correct prediction check if they're within the first `speed_bonus_first_n` correct answers — award `speed_bonus_points` extra

**Tie-breaker update:**
- After updating `total_points` and `correct_predictions`, recalculate `tiebreaker_score`:
  - accuracy mode: `correct_predictions / total_predictions` (float)
  - time mode: unix epoch of `last_correct_at` as a negative (so smaller = better rank)

**Frozen leaderboard guard:**
- Check `match_scoring_config.leaderboard_frozen` before writing leaderboard updates
- If frozen, still score the `predictions` table (mark is_correct/points_earned) but skip leaderboard writes
- Return `{ success: true, leaderboard_frozen: true }` so admin UI can show warning

---

## Part 3 — New `/admin/leaderboard` page

New file: `src/pages/admin/AdminLeaderboard.tsx`

**Sections:**

**Header card: match selector + scoring config**
- Select active match (dropdown)
- Inline editable config: `points_per_correct`, `points_per_over_correct`, `speed_bonus_enabled`, `tiebreaker_mode`
- Save button → upsert `match_scoring_config`
- **Freeze Leaderboard** toggle → updates `match_scoring_config.leaderboard_frozen`

**Leaderboard table (full, not top-20 cap)**
- Columns: Rank, Name, Points, Adjustment, Total, Accuracy, Windows Predicted, Last Correct, Actions
- "Total" = `total_points + points_adjustment`
- Row action: **"Adjust Points"** inline — click opens an inline +/- input and reason field → `UPDATE leaderboard SET points_adjustment, adjustment_reason` directly
- Search/filter by name
- Realtime updates using `useRealtimeChannel`

**Export CSV button** — client-side CSV generation from current leaderboard data:
```typescript
const csv = [header, ...entries.map(row => cols.join(','))].join('\n');
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
// trigger download
```

---

## Part 4 — Fan `Leaderboard.tsx` improvements

- Show accuracy percentage: `(correct/total * 100).toFixed(0)%`
- Use `total_points + points_adjustment` as displayed score (need to add `points_adjustment` to the SELECT)
- Order by `total_points + points_adjustment DESC, tiebreaker_score DESC` — but since we can't do arithmetic in Supabase client `.order()`, add a `rank_position` column that gets updated on every resolve to pre-compute rank — the leaderboard is ordered by `rank_position ASC`
- Small accuracy badge next to name

Actually simpler: compute effective score in `resolve-prediction-window` and store `rank_position`. Then the fan leaderboard can just `order('rank_position', ascending: true)`.

---

## Part 5 — `AdminSidebar` + routing

Add `{ icon: Trophy, label: 'Leaderboard', to: '/admin/leaderboard' }` to nav items.
Add route in `App.tsx`: `<Route path="leaderboard" element={<AdminLeaderboard />} />`.

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | `match_scoring_config` table + extend `leaderboard` columns |
| `supabase/functions/resolve-prediction-window/index.ts` | Read scoring config, speed bonus, tie-breaker update, frozen guard |
| `src/pages/admin/AdminLeaderboard.tsx` | New page: config editor, full leaderboard table, manual adjust, freeze, CSV export |
| `src/components/admin/AdminSidebar.tsx` | Add Leaderboard nav entry |
| `src/App.tsx` | Add `/admin/leaderboard` route |
| `src/components/live/Leaderboard.tsx` | Show accuracy %, use `points_adjustment` in display, order by `rank_position` |

---

## Tie-breaker detail

`rank_position` is recomputed after each window resolve:
```sql
-- In edge function, after all leaderboard rows updated for this window:
UPDATE leaderboard SET rank_position = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      ORDER BY (total_points + points_adjustment) DESC,
              tiebreaker_score DESC,
              last_updated ASC  -- earliest last update = faster player
    ) AS rn
  WHERE match_id = $match_id
) sub
WHERE leaderboard.id = sub.id
  AND leaderboard.match_id = $match_id;
```
This runs inside the edge function using the service role client.

## Non-gambling compliance note
The admin leaderboard page will include a visible disclaimer at the top: "This is a fun entertainment leaderboard. Points have no monetary value. No gambling or wagering." The export CSV also includes a header row with this disclaimer.
