
## Super Over System — Final Plan (Approved for Implementation)

### Database Migration
- Extend `match_phase_enum` to add `'super_over'`
- Create `public.super_over_rounds` table with columns: `id, match_id, round_number, innings_a_no, innings_b_no, team_a_id, team_b_id, team_a_score, team_a_wickets, team_b_score, team_b_wickets, status (pending|innings_a|innings_b|complete), winner_team_id, is_tied, activated_by_admin_id, created_at, completed_at`
- RLS: readable by all, writable by authenticated
- Extend `match_live_state` with: `super_over_active, super_over_round, super_over_innings, super_over_score, super_over_wickets, super_over_overs`

### New edge function: `super-over-control`
Actions: `activate | start_innings | complete_innings | add_round | finalize`
- `activate`: validate tie, create round 1, set `super_over_active=true`, `phase=super_over`
- `start_innings`: set batting/bowling teams, update round status, clear live players
- `complete_innings`: re-sum deliveries server-side, save to `super_over_rounds`, if both done → compare scores and set winner or `is_tied=true`, set round `status=complete`
- `add_round`: guard `is_tied=true`, create next round, reset live super over score to 0
- `finalize`: guard no active innings, set `phase=ended`, log result

### `record-delivery` update
Route `innings_no >= 3` to `super_over_score / super_over_wickets / super_over_overs` instead of `innings2_*`. Also update `super_over_rounds` team score in real-time during delivery recording.

### `match-control` update
Allow `'super_over'` in `set_phase` — apply same side-effects as `innings2` (clear players, lock prediction windows).

### `supabase/config.toml`
Add `[functions.super-over-control]` with `verify_jwt = false`.

### `AdminControl.tsx`
- Add `super_over` tab (Swords icon) — visible only when: phase is `super_over`, OR scores tied after innings2, OR match ended with tied scores
- Update `PhaseBadge` for `super_over` (amber style)
- Add `super_over` to phaseButtons
- Add `super_over_rounds` to realtime subscriptions
- New `SuperOverTab` component inside the file:
  - **Tie detection card**: shows when not yet active, with "Activate Super Over" + confirmation dialog
  - **Active round panel**: round badge, score comparison, Start/Complete buttons for innings A and B, auto-alert when round ties
  - **Round history**: collapsible list of all completed rounds with winner/tied status

### `Scoreboard.tsx`
- Add `super_over` to `phaseLabel` map
- Fetch `super_over_rounds` on initial data load
- Subscribe `super_over_rounds` in realtime channel
- When `phase === 'super_over'`: render amber-bordered score card, `super_over_score/wickets`, round badge, collapsible "Regular Match Summary" (both innings), target line for innings B
- When `phase === 'ended'` with super over rounds: add "Decided via Super Over Round N" to the ended card

### Key integrity guarantees
- `innings_no >= 3` never touches `innings1_score` / `innings2_score`
- `complete_innings` recomputes score from deliveries server-side (not trusting any client value)
- `activate` blocked if `super_over_active` already true
- `finalize` blocked if any round status is `innings_a` or `innings_b`
- All actions write audit rows to `admin_activity`
