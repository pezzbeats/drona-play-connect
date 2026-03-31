

## Multi-Match Access & Admin Automation

### Part 1: Users Access All Active Matches

**Current behavior**: The `/live` page loads only ONE match. `verify-game-pin` returns a single `match_id`. Users who registered for past matches can't see new active ones.

**New behavior**: Users who have *any* `game_access` record can see all currently active/live matches and upcoming ones.

#### Changes:

**A. `supabase/functions/verify-game-pin/index.ts`**
- After validating mobile+PIN against any `game_access` record, return `{ valid: true, mobile }` instead of a single `match_id`
- Keep backward compatibility: still return `match_id` of the active match if one exists
- Add a new field `has_any_access: true` so the client knows this user is a registered player

**B. `src/pages/Live.tsx` — Multi-match support**
- After session validation, fetch ALL matches where status is `live` or `registrations_open` (not just `is_active_for_registration`)
- Also fetch any match the user has `game_access` for that is `ended` (to see results)
- If multiple matches: show a match selector/list before entering LiveContent
- If single match: go directly to LiveContent (current behavior)
- Match list shows: match name, teams, status badge (Live/Upcoming/Ended), start time

**C. `src/pages/Index.tsx` — GameLoginCard**
- After successful login, if multiple active matches exist, navigate to `/live` which will show the match picker
- Store session without a fixed `match_id` — let Live page resolve it

### Part 2: Admin Panel — Auto-Discovery & Realtime

**D. `supabase/functions/cricket-api-sync/index.ts` — Expand discovery window**
- Change `doDiscover` to find matches within **next 48 hours** instead of just today
- This auto-creates upcoming matches from the API before they start
- Auto-set `is_active_for_registration = true` for matches starting within 24 hours
- Auto-set status transitions: `registrations_open` → `live` → `ended` based on API status

**E. `src/pages/admin/AdminMatches.tsx` — Realtime + better organization**
- Add realtime subscription on `matches` table for INSERT/UPDATE events
- Group matches into sections: "Live Now", "Upcoming", "Ended" with visual separation
- Show next match prominently with countdown
- Auto-refresh on realtime events instead of manual reload

**F. `src/pages/admin/AdminDashboard.tsx` — Upcoming matches widget**
- Add an "Upcoming Matches" section below quick actions
- Show next 2-3 matches with start times and status
- Realtime subscription already exists for orders; extend channel to include matches table

### File Summary

| File | Change |
|---|---|
| `supabase/functions/verify-game-pin/index.ts` | Return access for any registered user, not just active match |
| `src/pages/Live.tsx` | Multi-match picker when multiple active matches; fetch all accessible matches |
| `src/pages/Index.tsx` | Update GameLoginCard to work without fixed match_id |
| `supabase/functions/cricket-api-sync/index.ts` | Expand discover window to 48 hours; auto-activate matches within 24 hours |
| `src/pages/admin/AdminMatches.tsx` | Add realtime subscription; group by Live/Upcoming/Ended sections |
| `src/pages/admin/AdminDashboard.tsx` | Add upcoming matches widget with countdown |

