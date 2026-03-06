
# Full Build Plan — T20 Fan Night Phase 1 + Live Engine

## Current State Assessment

The app already has:
- ✅ Complete DB schema (Phase 1 tables)
- ✅ 7 edge functions deployed
- ✅ Registration flow (4 steps) + Ticket page + Play login
- ✅ Admin suite: login, dashboard, matches, match detail, orders, validate, manual booking
- ✅ Glassmorphism design system

## What's MISSING / Broken

**Critical gaps:**
1. **Live Cricket Engine** — no tables, no admin control center, no `/live` page
2. **Prediction Game** — no tables, no windows, no UI
3. **Leaderboard** — no table, no UI
4. **Teams/Players/Roster** — no tables
5. **`/live` route** — doesn't exist (Play.tsx redirects there but nothing renders)
6. **Realtime** — not implemented anywhere
7. **`order_seat_pricing` INSERT policy** — current policy broken (non-service inserts fail)
8. **Loyalty pricing logic** — `pricing-quote` function has incomplete loyalty logic (first-seat returning but no seat-count-cap logic)
9. **Admin Control Center** — not built
10. **Match detail** — no link to loyalty match picker (UI-only fix)
11. **`/ticket` page** — needs order lookup by mobile+match
12. **`/live` page** — full realtime scoreboard + prediction game UI

---

## Phase 2 DB Schema (new migration)

### New tables:
```
teams               — id, name, short_code, color, logo_path
players             — id, team_id, name, role (batsman/bowler/all_rounder/wicketkeeper)
match_roster        — id, match_id, team_id (home/away), is_batting_first

match_live_state    — id (1 per match), match_id, phase (pre/innings1/break/innings2/ended),
                      innings1_score, innings1_wickets, innings1_overs,
                      innings2_score, innings2_wickets, innings2_overs,
                      current_innings, target_runs, current_striker_id,
                      current_non_striker_id, current_bowler_id,
                      last_delivery_summary, updated_at

over_control        — id, match_id, innings_no, over_no, status (pending/active/complete/locked),
                      bowler_id, created_at

deliveries          — id, match_id, over_id, innings_no, over_no, ball_no (legal), 
                      delivery_no (all incl. extras), bowler_id, striker_id,
                      runs_off_bat, extras_type (none/wide/no_ball/bye/leg_bye),
                      extras_runs, is_wicket, wicket_type, out_player_id,
                      fielder_id, free_hit, notes, created_at

prediction_windows  — id, match_id, over_id, window_type (ball/over),
                      opens_at, locks_at, status (open/locked/resolved),
                      correct_answer (jsonb)

predictions         — id, window_id, match_id, mobile, prediction (jsonb),
                      is_correct, points_earned, created_at,
                      UNIQUE(window_id, mobile)

leaderboard         — id, match_id, mobile, player_name, total_points,
                      correct_predictions, total_predictions, last_updated
                      UNIQUE(match_id, mobile)
```

### Realtime enabled on:
- `match_live_state`
- `over_control`
- `prediction_windows`
- `leaderboard`

---

## New Edge Functions

1. **`match-control`** — admin-only: update live state phase, set innings active/ended, manage breaks. Returns updated state.
2. **`over-control`** — admin-only: create over, open/lock/complete over, toggle ball window.
3. **`record-delivery`** — admin-only: record full delivery data, auto-compute score, handle extras (illegal delivery = extra ball), update `match_live_state` + update leaderboard if prediction window resolves.
4. **`submit-prediction`** — authenticated via game_access PIN session: validate user checked in, window open, submit/update prediction.
5. **`resolve-prediction-window`** — admin-only: lock window, set correct answer, score all predictions, update leaderboard.

---

## New / Updated Frontend Pages

### New pages:
- `/live` — **Customer Live Page** — realtime scoreboard + prediction game
  - Requires valid game_access session (mobile + PIN in localStorage after /play login)
  - Shows: live score, current over, batsmen, bowler, last delivery
  - Prediction UI: when window open, show choices, submit, lock feedback
  - Leaderboard tab
  - Disclaimer always visible

- `/admin/control` — **Admin Control Center**
  - Active match stats (registrations, paid, check-ins)
  - Live innings control (start innings, end innings, set break)
  - Over management (create over, open window, lock window, complete over)
  - Delivery entry form (full ball data)
  - Live score panel
  - Current prediction window status
  - Panic controls: freeze predictions, lock all windows
  - Top 10 leaderboard

### Updated pages:
- `/admin/matches/:id` — Add loyalty match picker dropdown (link `loyalty_from_match_id` to another match)
- `/ticket` — Fix lookup to handle orders by mobile + active match (currently uses token= param)
- `pricing-quote` edge function — Fix loyalty logic: cap at previous seat count for lower price, extras at full price

---

## Implementation Order

### Step 1 — DB Migration (Phase 2 tables + realtime)
- Create teams, players, match_roster, match_live_state, over_control, deliveries, prediction_windows, predictions, leaderboard
- Enable realtime for: match_live_state, over_control, prediction_windows, leaderboard
- Fix `order_seat_pricing` INSERT policy (currently broken for service_role)
- Fix `game_access` SELECT policy (duplicate open policy + authenticated)

### Step 2 — Edge Functions
- `match-control` (admin phase control)
- `over-control` (admin over management)
- `record-delivery` (full ball recording + score compute + leaderboard)
- `submit-prediction` (customer prediction)
- `resolve-prediction-window` (score predictions)
- Update `pricing-quote` — fix loyalty seat-count-cap logic
- Update `admin-checkin` — use `getClaims()` instead of `getUser()`

### Step 3 — Admin Control Center (`/admin/control`)
- Phase control panel (pre / innings1 / break / innings2 / ended)
- Over management UI
- Delivery entry form
- Realtime scoreboard preview
- Prediction window controls
- Stats counters

### Step 4 — Customer Live Page (`/live`)
- Guard: check localStorage for mobile+pin session
- Realtime Supabase subscription on match_live_state
- Scoreboard component (team scores, overs, batsmen, bowler)
- Live delivery feed
- Prediction game panel (animated window open/close)
- Leaderboard tab
- Always-visible disclaimer

### Step 5 — Routing + Navigation
- Add `/admin/control` to AdminLayout sidebar
- Add `/live` public route
- Fix `/play` to store session in localStorage and redirect to `/live`
- Add "Live Control" link in admin sidebar

---

## Files to Create/Edit

**New files:**
- `supabase/migrations/[ts]_phase2_live_engine.sql`
- `supabase/functions/match-control/index.ts`
- `supabase/functions/over-control/index.ts`
- `supabase/functions/record-delivery/index.ts`
- `supabase/functions/submit-prediction/index.ts`
- `supabase/functions/resolve-prediction-window/index.ts`
- `src/pages/admin/AdminControl.tsx`
- `src/pages/Live.tsx`
- `src/components/live/Scoreboard.tsx`
- `src/components/live/PredictionPanel.tsx`
- `src/components/live/Leaderboard.tsx`
- `src/components/admin/DeliveryForm.tsx`

**Edited files:**
- `src/App.tsx` — add `/live`, `/admin/control` routes
- `src/components/admin/AdminSidebar.tsx` — add Control Center link
- `src/pages/Play.tsx` — save mobile/pin to localStorage on success
- `src/pages/admin/AdminMatchDetail.tsx` — add loyalty match picker
- `supabase/config.toml` — add new functions with verify_jwt=false
- `supabase/functions/pricing-quote/index.ts` — fix loyalty cap logic
- `supabase/functions/admin-checkin/index.ts` — getClaims fix

---

## Technical Notes

- Realtime subscriptions use `supabase.channel()` with `postgres_changes` on `public` schema
- Session for `/live` stored in `localStorage` as `{ mobile, match_id }` — validated against `game_access` on mount
- Scoreboard updates via realtime on `match_live_state` — no polling
- Prediction window state via realtime on `prediction_windows`
- Admin delivery form auto-increments `delivery_no`, handles extra ball on wide/no-ball automatically
- Leaderboard updates server-side in `record-delivery` when prediction window resolves
- All 5 new edge functions use `getClaims()` pattern for auth (admin-only functions check auth.uid())
