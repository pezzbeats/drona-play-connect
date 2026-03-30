

## Problem
1. The landing page may show incorrect matches due to IST timezone edge cases or stale data
2. Users who registered for any past match cannot easily log back in — the current flow requires an active match

## Plan

### 1. Fix "Today's Matches" display to be always correct

**Current issue**: The IST date calculation works but the query only shows matches with `start_time` within today's IST bounds. If a match has no `start_time` or was activated but scheduled outside today, it won't appear.

**Fix**: Keep the IST-bounded query as the primary source, but also include any match with `is_active_for_registration = true` as a fallback (so admin-activated matches always show). Deduplicate by match ID.

**File**: `src/pages/Index.tsx` — update `fetchData()` to run two queries and merge results.

### 2. Fix game login to work for any registered user (not just active match)

**Current issue**: `verify-game-pin` edge function first looks for an active match, and if none exists, tries to find any match with active game access. This works, but the Play page and Index GameLoginCard always navigate to `/live` which expects a specific match context.

**Fix**: Update `verify-game-pin` to return the most recent match the user has access to (regardless of `is_active_for_registration`). The login flow already handles this — no frontend changes needed for this part.

### 3. Improve the GameLoginCard UX

- Add a "Forgot PIN?" link that says "Contact the venue to reset your PIN" (since we're skipping OTP for now)
- Show phone number with +91 prefix hint for clarity

## Technical Details

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | In `fetchData()`: add a second query for `is_active_for_registration = true` matches and merge with today's IST-filtered results, deduplicating by ID |
| `src/pages/Index.tsx` | In `GameLoginCard`: add "+91" prefix label and "Forgot PIN?" help text |
| `src/pages/Play.tsx` | Add "Forgot PIN?" section with venue contact info |
| `supabase/functions/verify-game-pin/index.ts` | When no active match exists, find the user's most recent `game_access` entry (ordered by `created_at desc`) instead of requiring exact match |

