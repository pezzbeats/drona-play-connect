
## Understanding

The user wants to manage the **actual playing XI lineups** for the India vs New Zealand match — entering real player names in batting order for each team. This is distinct from the generic "teams & players" concept. The lineup feeds the Live Control delivery dropdowns (striker, non-striker, bowler).

**What exists:**
- `teams` table: team entities (India, NZ) with name/color/short_code
- `players` table: players with `team_id`, `role`, `jersey_number` — global pool
- `match_roster` table: just assigns home/away teams + who bats first — no player order
- Live Control uses players from the `players` table filtered by team

**What's needed:**
- A dedicated **Match Lineup** section inside the Teams & Players admin page (or as a new tab)
- For the active match: pick India (home) and NZ (away) teams, then for each team enter the **playing 11 in batting order**
- Each lineup slot: player name, role, jersey number, batting position
- Save these as the lineup for the match — live control dropdowns read from this

**Approach — reuse `players` table + add a `match_lineup` table:**

The `players` table already holds players. We need to add a `match_lineup` table that stores:
- `match_id`
- `team_id`  
- `player_id` (FK to `players`)
- `batting_order` (integer 1–11)
- `is_playing` (boolean)

This way the admin can:
1. In Teams tab → ensure India and NZ teams exist
2. In Players tab → players are in the global pool (can pre-populate or add on the fly)
3. **New "Match Lineup" tab** → for the active match, for each team, pick the 11 players and set their batting order via a drag-sortable or numbered list

However, building a truly new table + migration is the cleanest approach. But given the admin already has a bulk import for players, the simpler UX is:

**Revised approach — Match Lineup tab with inline player entry:**

Add a new **"Lineup"** tab to `AdminTeams.tsx`. It shows both teams side-by-side. For each team:
- A list of 11 rows (positions 1–11)
- Each row: position number + player name text input + role dropdown + jersey # 
- "Save Lineup" saves/upserts players into `players` table AND saves their order into a new `match_lineup` table

This means the admin enters actual players like "Rohit Sharma", "Virat Kohli" etc. in batting order for the India vs NZ match specifically.

**Database change needed:**
```sql
CREATE TABLE public.match_lineup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  team_id uuid NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  batting_order integer NOT NULL,
  is_captain boolean NOT NULL DEFAULT false,
  is_wk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, team_id, batting_order),
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_lineup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lineup readable by all" ON public.match_lineup FOR SELECT USING (true);
CREATE POLICY "Lineup writable by authenticated" ON public.match_lineup FOR ALL 
  TO authenticated USING (true) WITH CHECK (true);
```

**UI — New "Lineup" tab in AdminTeams.tsx:**

```text
┌─────────────────────────────────────────────────────────┐
│  Active Match: India vs New Zealand (T20 WC Final)      │
│  [Active badge]                                         │
├──────────────────────────┬──────────────────────────────┤
│  🏏 INDIA (IND)          │  ✈️ NEW ZEALAND (NZ)         │
│  ┌──┬──────────────────┬─┐  ┌──┬──────────────────┬─┐  │
│  │1 │ Rohit Sharma  BAT│ │  │1 │ Conway       BAT │ │  │
│  │2 │ Virat Kohli   BAT│ │  │2 │ Williamson    BAT│ │  │
│  │3 │ ...           ...│ │  │3 │ ...          ... │ │  │
│  └──┴──────────────────┴─┘  └──┴──────────────────┴─┘  │
│  [Save India Lineup]         [Save NZ Lineup]           │
└─────────────────────────────────────────────────────────┘
```

Each row in the lineup has:
- Position # (fixed, 1–11)
- Player name (text input, auto-saves to `players` table on save)
- Role dropdown (BAT / BWL / AR / WK)
- Jersey # (small number input)
- ⭐ Captain toggle | 🧤 WK toggle

**Live Control integration:**
The `AdminControl.tsx` Roster tab currently fetches players from `players` table filtered by team. We update it to also read from `match_lineup` ordered by `batting_order` — so dropdowns show players in batting order.

## Files to change

### 1. New DB migration
Add `match_lineup` table with RLS.

### 2. `src/pages/admin/AdminTeams.tsx`
- Add `MatchLineupTab` component as a 4th tab "Lineup"
- Shows both teams for the active match side by side
- 11 editable rows per team: position, name, role, jersey, captain flag, WK flag
- On save: upsert players into `players` table, then upsert into `match_lineup`
- Pre-loads existing lineup if already saved

### 3. `src/pages/admin/AdminControl.tsx` (Roster tab)
- In the player dropdowns (striker, non-striker, bowler), fetch from `match_lineup` joined with `players` instead of plain `players` — so they appear in batting order and only show the 11 that are actually playing

### Flow
```text
Admin → Teams & Players → Lineup tab
  → Sees active match (India vs NZ)
  → Two columns: India | New Zealand  
  → Enters players 1-11 in batting order with role & jersey
  → Save → players upserted in `players` table + `match_lineup` created
  
Live Control → Roster tab → Striker/Non-striker/Bowler dropdowns
  → Reads from match_lineup for active match (ordered by batting_order)
  → Players show in correct batting order
```
