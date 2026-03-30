

## Problem

The landing page shows 3 match cards because the query fetches **all non-draft matches with a `start_time` falling on today (IST)**. If the API sync created multiple matches for today (or the same match was duplicated with different statuses), they all appear. There is no filter to show only the **relevant** match.

## Root Cause

**Line 504-511** in `Index.tsx`:
```ts
supabase.from('matches')
  .select(...)
  .gte('start_time', todayStartUTC.toISOString())
  .lte('start_time', todayEndUTC.toISOString())
  .neq('status', 'draft')
```

This returns every match scheduled today that isn't a draft — including `ended`, `registrations_closed`, and duplicate entries from API sync.

## Solution

**File: `src/pages/Index.tsx`** — Tighten the "today's matches" query:

1. **Filter to only actionable statuses**: Change `.neq('status', 'draft')` to `.in('status', ['registrations_open', 'live'])` for the today query. This excludes `ended`, `registrations_closed`, and `draft` matches from cluttering the page.

2. **Keep the active-registration fallback** (Query 2) as-is — it already filters by `is_active_for_registration = true`.

3. **Add ended matches as a separate, collapsed section** (optional): If the user wants to see ended matches, show them below the active ones with a "Completed Today" label, but don't count them toward the "Matches Today" banner count.

### Specific Change

```ts
// Query 1: today's ACTIVE matches only
supabase
  .from('matches')
  .select('id, name, opponent, venue, start_time, status, match_type')
  .gte('start_time', todayStartUTC.toISOString())
  .lte('start_time', todayEndUTC.toISOString())
  .in('status', ['registrations_open', 'live'])
  .order('start_time', { ascending: true }),
```

This single line change (`.neq('status', 'draft')` → `.in('status', ['registrations_open', 'live'])`) ensures only the one active/live match appears as a prominent card. Ended and closed matches are excluded.

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Line 510: replace `.neq('status', 'draft')` with `.in('status', ['registrations_open', 'live'])` |

