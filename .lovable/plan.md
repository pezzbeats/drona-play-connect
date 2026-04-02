

## Fix: Automatic Match Lifecycle Management

### Root Causes Found

1. **Ended matches never clear `is_active_for_registration`**: When `phase === "ended"` (lines 823-824) and abandoned handling (line 551), the code sets `status: "ended"` but never sets `is_active_for_registration: false`. Result: stale matches remain "active."

2. **Landing page query is too narrow**: `Index.tsx` only fetches matches within today's IST window. Tomorrow's match (CSK vs PBKS, April 3) won't appear even though auto-promote activates it 24 hours early.

3. **No cleanup of stale registration flags**: There's no logic anywhere that deactivates registration for ended/completed matches on a recurring basis.

### Fixes

**File 1: `supabase/functions/cricket-api-sync/index.ts`**

Add `is_active_for_registration: false` everywhere a match transitions to `ended`:

- Line ~551 (abandoned): add to the `.update({ status: "ended" })` call
- Line ~824 (completed): add to the `.update({ status: "ended" })` call
- At the top of `doSync`, add a bulk cleanup query:
  ```sql
  UPDATE matches SET is_active_for_registration = false
  WHERE status = 'ended' AND is_active_for_registration = true
  ```

**File 2: `src/pages/Index.tsx`**

Widen the landing page query to also show matches starting within the next 24 hours (not just today IST):

- After the "today" query, if results are empty, query for the next match with `status IN ('registrations_open', 'draft')` and `start_time` within 48 hours instead of only after today's IST end.
- Also show matches with `is_active_for_registration = true` regardless of date window (in case auto-promote already activated them).

**File 3: Database cleanup (one-time insert query)**

Fix the current stale data:
```sql
UPDATE matches SET is_active_for_registration = false
WHERE status = 'ended' AND is_active_for_registration = true;
```

### Summary

| File | Change |
|---|---|
| `supabase/functions/cricket-api-sync/index.ts` | Clear `is_active_for_registration` on ended/abandoned; add bulk cleanup at start of sync |
| `src/pages/Index.tsx` | Widen query to include active-registration matches + next 48h upcoming |
| DB (insert tool) | One-time fix for currently stale ended matches |

