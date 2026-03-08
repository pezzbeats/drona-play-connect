
## Root Cause Analysis

The network logs confirm the active match `India vs New Zealand` IS returned correctly by the API (`is_active_for_registration=true`, status 200). The session replay shows the preview **is** showing the match with the countdown timer. The "Coming Soon" screen only appears when `match === null` after `fetchData()` completes.

**Three compounding issues found:**

### Issue 1 — Fragile error handling in `fetchData` (Index.tsx, lines 279-283)
The `try/catch` silently swallows errors and falls through with `match = null`, rendering "Coming Soon". Any transient network error, Supabase RLS hiccup, or CORS issue on the published domain causes the entire match section to show "Coming Soon" with no retry mechanism.

### Issue 2 — No retry / stale-cache recovery 
`fetchData` is called exactly once on mount (line 251). If it fails transiently (published app cold-start, CDN edge, or Supabase connection blip), there is no retry. The user is permanently stuck on "Coming Soon" until they manually refresh.

### Issue 3 — `useSiteConfig` module-level cache can carry stale state
The `let cache: ConfigMap | null = null` at module scope (line 12 of `useSiteConfig.ts`) is a singleton that persists across React hot reloads and navigations within the same session. In the published build, if `site_config` fetch fails first time, `cache` remains `null` and re-tries correctly — but if a navigation happens mid-fetch, the cache could be partially populated. Not the primary cause here, but a lurking bug.

### Issue 4 — `status: "draft"` vs registration open (UX confusion)
The match has `status: "draft"` and `is_active_for_registration: true`. This is fine — the landing page uses only `is_active_for_registration`. But admin has no clear guidance that these are two separate fields and must both be set. This causes configuration mistakes.

---

## Fix Plan

### 1. `src/pages/Index.tsx` — Retry logic + error state

**Change `fetchData` to:**
- Retry up to 3 times with 1.5s delay on failure (covers transient network errors)
- Track a separate `fetchError` state
- When `fetchError` is true after all retries, show a "Retry" button instead of permanently showing Coming Soon
- Add a `match` refresh button (subtle, already re-fetches on interaction)

**Specific change in `fetchData`:**
```ts
const fetchData = async (attempt = 0) => {
  setLoading(true);
  try {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, name, opponent, venue, start_time, status, match_type')
      .eq('is_active_for_registration', true)
      .maybeSingle();

    if (matchError) throw matchError; // ← was silently swallowed before

    if (matchData) {
      setMatch(matchData);
      setFetchError(false);
      // ... rest of parallel fetches
    } else {
      setMatch(null);
      setFetchError(false);
    }
  } catch (e) {
    console.error('[Index] fetchData error:', e);
    if (attempt < 2) {
      setTimeout(() => fetchData(attempt + 1), 1500 * (attempt + 1));
      return; // don't setLoading(false) yet
    }
    setFetchError(true);
  } finally {
    setLoading(false);
  }
};
```

**Change in `useEffect`:**
```ts
useEffect(() => {
  const timeout = setTimeout(() => setLoading(false), 10000); // safety
  fetchData(0).finally(() => clearTimeout(timeout));
}, []);
```

**Add a "retry" CTA in the Coming Soon section:**
When `fetchError`, show a "Retry Loading" button instead of/alongside the Coming Soon card.

### 2. `src/pages/Index.tsx` — Add a "Refresh" button to the Coming Soon card

When `match === null && !loading && !fetchError`, keep existing UI but add a small refresh button. This allows users to retry without full page reload.

### 3. `src/pages/admin/AdminMatchDetail.tsx` — Clarify status vs registration toggle

Add a helper note in the match detail form explaining the two controls:
- **Match Status** (draft/open/live/ended) — controls Match Control phase
- **Active for Registration** toggle — controls whether this match appears on the landing page

This prevents future admin configuration confusion (setting match active but forgetting to update status).

### 4. `src/hooks/useSiteConfig.ts` — Add retry on fetch failure

If the `site_config` fetch throws, retry once after 2s. This prevents empty fallbacks on cold-start in the published build.

---

## Files to change

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Add retry logic (3 attempts, 1.5s backoff), `fetchError` state, retry button in Coming Soon |
| `src/hooks/useSiteConfig.ts` | Add single retry on fetch failure |
| `src/pages/admin/AdminMatchDetail.tsx` | Add tooltip/note clarifying status vs is_active_for_registration |

No database changes, no edge function changes, no other pages affected.

---

## "Never happens again" — defensive additions

- Error is now surfaced (not silently swallowed) so it will appear in console logs
- Retry mechanism means 1 transient failure won't block the user
- After 3 retries fail, user sees a "Reload Page" button — not a permanent "Coming Soon" 
- The Coming Soon card is only shown when `match === null` AND `!fetchError` AND `!loading` (currently it conflates "no match" with "fetch failed")
