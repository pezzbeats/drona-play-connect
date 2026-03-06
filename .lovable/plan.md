
## Root Cause

There are **two compounding bugs** causing the Register button to disappear:

### Bug 1: `.single()` silently kills the match (primary cause)

In `fetchData()` (line 68):
```ts
.single()  // ❌ throws PGRST116 error if anything goes wrong
```
Supabase's `.single()` returns an **error** if the row count isn't exactly 1 (including transient network hiccups, brief DB lag, etc.). This error is silently swallowed by `catch { }` on line 84, leaving `match = null`. The fix is `.maybeSingle()` — which returns `{ data: null, error: null }` on zero results instead of throwing.

### Bug 2: CTA button lives entirely inside the match-truthy branch (secondary cause)

The "Reserve Your Seats Now" button and "View Your Passes" link are only rendered when `match !== null` (lines 313–326). So when Bug 1 fires, the button disappears even though a real active match exists in the database. This is a UX resilience failure — the CTA should never vanish silently.

Database confirms the match IS there and active:
- `India vs New Zealand - T20 World Cup Final`, `is_active_for_registration: true`
- Pricing rule exists (₹999 new, ₹949 returning)
- RLS policies are correct (public SELECT allowed)

---

## Fix

**File: `src/pages/Index.tsx`** — two targeted changes:

### Change 1 — Replace `.single()` with `.maybeSingle()` + expose errors (line 68)
```ts
// Before:
.single();

// After:
.maybeSingle();
```
Also add `const { data: matchData, error: matchError } = ...` and log the error so it's visible in the console for future debugging instead of being silently swallowed.

### Change 2 — Move the CTA outside the match branch (lines 313–326)
The "Reserve Your Seats Now" button and "View Your Passes" link should **always render** when the page loads — they should not be conditional on `match !== null`.

Move the CTA block to just below the `{match ? ... : ...}` block so it renders regardless:

```text
Page layout after fix:
├── Hero section (always)
├── {match ? (
│     Banner, Match Card, Features, Pricing, Trust Strip
│   ) : (
│     Coming Soon card
│   )}
├── ─── Reserve Your Seats Now ─── ← ALWAYS VISIBLE (moved here)
├── Legal Disclaimer
├── Business Trust Block
└── Footer
```

This way even if the match fetch fails, users still see the register button and can complete their booking.

### Files to modify
| File | Change |
|---|---|
| `src/pages/Index.tsx` | `.single()` → `.maybeSingle()`, move CTA outside match branch, add error logging |
