

## Analysis

### What "Trial Game" needs to do
1. Create a temporary, isolated **trial match** record (flagged as `is_trial = true`) with dummy teams/players seeded into it — using real DB tables but isolated by a special field
2. Provide a **self-contained admin UI** at `/admin/trial-game` that replicates the full match command loop (Open Window → Lock → Record Ball → Auto-Resolve) against this trial match
3. The trial match must **never** appear on customer-facing routes (`/play`, `/live`) since those routes only read the `is_active_for_registration = true` match
4. After the trial is complete, a **"Wipe Trial Data"** button deletes all rows tied to that trial match (deliveries, overs, live state, predictions, prediction_windows, leaderboard, flags) and optionally the trial match row itself

### How isolation works (no DB schema change needed)
- The `matches` table already has a `name` field and `is_active_for_registration` boolean
- Trial match will be created with `is_active_for_registration = false` and name = `"[TRIAL] Staff Rehearsal"` — customer-facing `/play` and `/live` pages query `is_active_for_registration = true`, so the trial is invisible to customers
- No new column needed: we identify trial matches by their name prefix `[TRIAL]` or we can use the `match_type` field (currently `group`/`final`/`semi_final`) — but safest is a dedicated name pattern so it's unambiguous
- Actually, looking at the schema: `match_type` is a user-defined enum so we can't add values without migration. The cleanest zero-migration approach: trial match is created with a name prefixed `[TRIAL]` and `status: 'draft'` and `is_active_for_registration: false`. The existing `AdminControl` page reads `is_active_for_registration: true` — so the trial won't load there.

### Architecture: Reuse `AdminControl` component entirely

The entire delivery/prediction loop is already implemented in `AdminControl.tsx`. Instead of duplicating it, the trial page will:
1. Embed the `AdminControl` logic but **target a specific trial match** (not the `is_active_for_registration` one)
2. The simplest approach: create a **new page `AdminTrialGame.tsx`** that is a thin wrapper around a modified data-fetching approach — pass a `trialMatchId` prop, or better: create a completely self-contained "mini control center" that only does the prediction game loop (no scoring, no roster complexity) with dummy players

However, `AdminControl` is 1883 lines and has `fetchAll` hardcoded to `is_active_for_registration: true`. Extracting it would require significant refactoring.

**Better approach**: The trial page manages its own trial match state and calls the same edge functions with the trial match's ID. It needs:
- Setup section: Create trial match + seed dummy players + init live state + create a dummy over
- A simplified delivery + prediction loop (same 11 outcomes, same edge functions)  
- Wipe section: Delete all trial data

### What the Trial Game page contains

```
┌─────────────────────────────────────────────────────┐
│  ⚗️ Trial Game — Staff Rehearsal                     │
│  [TRIAL MATCH NOT VISIBLE TO CUSTOMERS]              │
│─────────────────────────────────────────────────────│
│  SETUP PHASE (no trial match exists)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Create Trial Match                              │ │
│  │ (seeds: 5 dummy batters, 3 dummy bowlers,       │ │
│  │  creates over, inits live state)                │ │
│  └─────────────────────────────────────────────────┘ │
│─────────────────────────────────────────────────────│
│  ACTIVE PHASE (trial match exists)                   │
│  Status: Window OPEN / LOCKED / No Window            │
│─────────────────────────────────────────────────────│
│  PREDICTION WINDOW CONTROL                           │
│  [Open Guesses] [Lock Window]  predictions: N        │
│─────────────────────────────────────────────────────│
│  BALL OUTCOME GRID (11 options)                      │
│  [• Dot][1][2][3][4][6][WD][NB][B][LB][W]           │
│  [Record Ball] ← disabled until window locked        │
│─────────────────────────────────────────────────────│
│  LAST 6 BALLS: • 1 4 W WD •                         │
│─────────────────────────────────────────────────────│
│  WIPE TRIAL DATA  (danger zone, always visible)      │
│  [🗑 Delete All Trial Data]                          │
└─────────────────────────────────────────────────────┘
```

### Files to create/modify

| File | Action |
|------|--------|
| `src/pages/admin/AdminTrialGame.tsx` | CREATE — self-contained trial game page |
| `src/App.tsx` | ADD route `/admin/trial-game` under `ProtectedRoute requiredRole="operator"` |
| `src/components/admin/AdminSidebar.tsx` | ADD nav item "Trial Game" (operator+) |
| `src/components/admin/AdminBottomNav.tsx` | ADD nav item to overflow list |

No edge function changes. No DB schema changes.

### Detailed implementation plan for `AdminTrialGame.tsx`

**State:**
- `trialMatch` — the trial match row (null if none exists)
- `activeWindow` — open prediction_windows row for trial match
- `trialOvers` — over_control rows for trial match
- `activeOver` — current active over
- `recentDeliveries` — last N deliveries (for ball display)
- `selectedOutcome` — BallOutcomeKey | null
- `setupLoading`, `actionLoading` — loading states

**Dummy seed data (inline constants, no new tables):**
```typescript
const DUMMY_TEAM = { name: 'Team Alpha', short_code: 'TMA' };  // vs Team Beta
const DUMMY_BATTERS = ['Dummy Batter 1', ... × 5];
const DUMMY_BOWLERS = ['Dummy Bowler A', 'Dummy Bowler B', 'Dummy Bowler C'];
```

**`handleSetupTrial`:**
1. Create two dummy teams (or reuse existing ones by name check)
2. Create players for those teams
3. Create match row: `name: '[TRIAL] Staff Rehearsal'`, `is_active_for_registration: false`, `status: 'draft'`, `event_id` = same event_id as used in AdminMatches (hardcoded UUID)
4. Create `match_roster` entries for the two teams
5. Create `match_lineup` entries for the players
6. Call `match-control` edge function with `action: 'init'` to create `match_live_state`
7. Call `match-control` with `action: 'set_phase'`, `phase: 'innings1'` 
8. Set batting/bowling teams
9. Call `over-control` edge function with `action: 'create_over'`
10. Set `trialMatch` state

**`handleOpenWindow`:** calls `resolve-prediction-window` with `action: 'open'`, using `trialMatch.id` and `BALL_OUTCOMES`

**`handleLockWindow`:** same as AdminControl

**`handleRecordBall(key: BallOutcomeKey)`:**
1. Guard: `activeWindow` must be null (locked or no window) — button disabled otherwise
2. Call `record-delivery` edge function with trial match/over IDs and the prefilled delivery data from the selected outcome key
3. Auto-resolve: find most recent locked window for trial match, call `resolve-prediction-window`
4. Reset selectedOutcome, refetch

**`handleWipeTrialData`:** 
```sql
-- All deletes scoped to trialMatch.id:
DELETE FROM predictions WHERE match_id = trialMatch.id
DELETE FROM leaderboard WHERE match_id = trialMatch.id
DELETE FROM prediction_windows WHERE match_id = trialMatch.id
DELETE FROM deliveries WHERE match_id = trialMatch.id
DELETE FROM over_control WHERE match_id = trialMatch.id
DELETE FROM match_live_state WHERE match_id = trialMatch.id
DELETE FROM match_flags WHERE match_id = trialMatch.id
DELETE FROM match_roster WHERE match_id = trialMatch.id
DELETE FROM match_lineup WHERE match_id = trialMatch.id
DELETE FROM players WHERE team_id IN (trial team IDs)
DELETE FROM teams WHERE id IN (trial team IDs)
DELETE FROM matches WHERE id = trialMatch.id
```
All done from client using service role isn't possible from client — but since these are authenticated admin actions and the RLS policies allow `authenticated` users to write/delete on most tables (deliveries, over_control, match_live_state, match_flags, prediction_windows, predictions, leaderboard are all deletable by authenticated), we can do these from the Supabase client directly.

Wait — checking RLS: `predictions` can't DELETE, `leaderboard` can't DELETE, `tickets` can't DELETE. Let me re-check:
- `predictions`: no DELETE policy listed → can't delete from client
- `leaderboard`: no DELETE policy → can't delete from client  
- `deliveries`: has `ALL` for authenticated → can DELETE
- `over_control`: has `ALL` for authenticated → can DELETE
- `match_live_state`: has `ALL` for authenticated → can DELETE
- `match_flags`: has `ALL` for authenticated → can DELETE
- `prediction_windows`: has `ALL` for authenticated → can DELETE
- `match_roster`: has `ALL` for authenticated → can DELETE
- `match_lineup`: has `ALL` for authenticated → can DELETE
- `players`: has `ALL` for authenticated → can DELETE
- `teams`: has `ALL` for authenticated → can DELETE
- `matches`: has `ALL` for authenticated → can DELETE

For `predictions` and `leaderboard` (no DELETE from client), we need a DB migration to add DELETE policies for authenticated users **scoped to trial matches only**, OR we create a new edge function `trial-game-cleanup` that uses the service role to wipe everything.

**Decision: Create a single edge function `trial-game-cleanup`** that takes `match_id`, verifies the match name starts with `[TRIAL]` (safety guard), then deletes all related rows using service role. This also handles `predictions` and `leaderboard` which can't be deleted from the client.

### Edge function: `supabase/functions/trial-game-cleanup/index.ts`

- Authenticated (JWT validated)
- Takes `{ match_id }`
- Safety check: `SELECT name FROM matches WHERE id = match_id` — must start with `[TRIAL]`
- Deletes in dependency order:
  1. predictions (scoped by match_id)
  2. leaderboard (scoped by match_id)
  3. prediction_windows
  4. deliveries
  5. over_control
  6. match_live_state
  7. match_flags
  8. match_scoring_config
  9. game_access (scoped by match_id)
  10. orders (scoped by match_id, if any)
  11. tickets (scoped by match_id, if any)  
  12. match_lineup
  13. match_roster
  14. matches row itself
  15. players for the dummy teams (need to track team IDs first)
  16. teams

### Route: `/admin/trial-game`
- Protected with `requiredRole="operator"`
- Not listed on customer-facing routes (not in HIDE_VOICE_AGENT_PATHS needed since it's admin-only)

### Sidebar/BottomNav additions
- Sidebar: add `{ icon: FlaskConical, label: 'Trial Game', to: '/admin/trial-game', minRole: 'operator' }`
- BottomNav: add same to `allNavItems`

### Key safety mechanisms
1. Trial match created with `is_active_for_registration: false` — invisible to all customer routes
2. Trial match name always `[TRIAL] Staff Rehearsal` — visually obvious in any DB view
3. Cleanup edge function double-checks name starts with `[TRIAL]` before deleting anything
4. "Wipe" button requires a confirmation AlertDialog: "This will permanently delete all trial game data. Are you sure?"
5. The trial game page shows a prominent yellow banner: "TRIAL MODE — This data is not visible to customers and will be deleted when you wipe."

### What admins can test end-to-end
1. Click "Create Trial Match" → match + teams + players + over all set up
2. Click "Open Guesses" → prediction window opens (they can open `/play` in another tab, enter any mobile + a dummy PIN to see the customer view... but since this is a non-active match, the `/play` route won't show it)
3. Actually for testing the customer-side, the admin can manually navigate to `/live?match_id=<trial_id>` — but `/live` reads the active match. So for full end-to-end testing of the customer prediction UI, this is admin-side only.
4. Lock window → Record Ball → verify auto-resolution toast → repeat

### No changes to any existing pages, edge functions, or DB schema (except new edge function and new page)

