
## Teams & Players Management — `/admin/teams`

### What to build

A new admin page at `/admin/teams` with 3 sections in tabs:

1. **Teams tab** — list of teams, create/edit team (name, short code, color)
2. **Players tab** — list all players grouped by team, add player (name, role, jersey number, assign to team)
3. **Match Roster tab** — pick the active match, then assign Home/Away teams and toggle which team bats first; this populates the delivery form dropdowns in `/admin/control`

### Files to create/edit

**New:**
- `src/pages/admin/AdminTeams.tsx` — full page with 3 tabs

**Edited:**
- `src/App.tsx` — add `/admin/teams` route
- `src/components/admin/AdminSidebar.tsx` — add "Teams & Players" nav item with `Users` icon

### Implementation detail

**Teams tab:**
- `supabase.from('teams').select('*')` to list
- Create dialog: fields for `name`, `short_code`, `color` (color picker input type=color)
- Edit inline or via same dialog
- Shows player count badge per team

**Players tab:**
- `supabase.from('players').select('*, teams(name)')` to list with team name
- Create dialog: fields for `name`, `role` (enum: batsman/bowler/all_rounder/wicketkeeper), `jersey_number`, `team_id` (select from teams)
- Grouped by team with a simple filter dropdown
- Edit / delete player rows

**Match Roster tab:**
- Fetch active match (`is_active_for_registration = true`) — show match name
- Load current `match_roster` for that match
- Two dropdowns: "Home Team" and "Away Team" (both pull from `teams`)
- Toggle: "Which team bats first?" (radio: Home / Away)
- Save → upsert into `match_roster` (2 rows: one home, one away with `is_batting_first` set)
- After save, show confirmation that the delivery form in Live Control will now see these players

**Connection to AdminControl delivery form:**
- The existing `AdminControl.tsx` already queries `match_roster → players` — once roster is set here, it automatically populates the dropdowns in Live Control with no additional changes needed.

### DB changes
No schema changes needed — `teams`, `players`, and `match_roster` tables already exist with correct columns from Phase 2 migration.

### Route & Sidebar
- Add `{ icon: Users, label: 'Teams & Players', to: '/admin/teams' }` to navItems array in `AdminSidebar.tsx`
- Add `<Route path="teams" element={<AdminTeams />} />` inside the protected `/admin` block in `App.tsx`
