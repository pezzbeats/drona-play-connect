

## Problem

The `teams` table has incorrect `short_code` values — all teams are stored as "A" or "B" instead of their proper IPL codes (RR, CSK, PBKS, GT). This means the `IPL_TEAM_LOGOS` lookup by short_code never matches, so it falls back to displaying the raw text "A" or "B".

## Plan

### 1. Fix team short_codes and colors in database
Run a migration to update the existing teams with correct short codes and brand colors:

| Team | short_code | color |
|------|-----------|-------|
| Rajasthan Royals | RR | #EA1A85 |
| Chennai Super Kings | CSK | #f9cd05 |
| Punjab Kings | PBKS | #ED1B24 |
| Gujarat Titans | GT | #1B2133 |

### 2. Fix the cricket-api-sync edge function
Update the sync logic so that when it creates/upserts teams from the Roanuz API, it maps teams to their correct IPL short codes and colors instead of defaulting to "A"/"B". This likely happens because the API returns `home`/`away` as sides and the code uses those as short codes.

### 3. Also update Register.tsx
The Register page has the same team display pattern — ensure it also uses the `IPL_TEAM_LOGOS` mapping so logos appear on the registration page too.

## Technical Details

- **Migration SQL**: `UPDATE teams SET short_code = 'RR', color = '#EA1A85' WHERE name = 'Rajasthan Royals'` (and similar for other teams)
- **Edge function fix**: In `cricket-api-sync/index.ts`, look at how teams are created and ensure the `short_code` is derived from a known IPL team name mapping rather than the match side ("A"/"B")
- **No new assets needed** — the PNG logos are already in `src/assets/ipl-teams/` and the lookup map exists; they just need correct short_codes to match against

