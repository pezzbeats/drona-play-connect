
## Root Cause Analysis

The screenshot shows the skeleton permanently stuck — the page never transitions from loading state to real content. The data, RLS policies, and network are all fine. There are **two separate bugs** causing this:

### Bug 1 — `useSiteConfig` can get permanently stuck at `loading: true`

In `src/hooks/useSiteConfig.ts`, the `fetch` function is defined **inside the hook body** but referenced inside a `useEffect`. If `site_config` returns an empty array (no rows) or if `data` is null/falsy, this code path runs:

```ts
const { data } = await supabase.from('site_config').select('key, value');
if (data) {          // ← if data is null or an empty array [], this is falsy
  ...
  setLoading(false); // ← setLoading(false) is INSIDE this if block
}
setLoading(false);   // ← this DOES exist... but wait:
```

Actually the `setLoading(false)` is after the if block. BUT: **there is no `try/catch`**. If the network request throws (mobile data, DNS issue, timeout), the `fetch` function throws, and `setLoading(false)` is **never called**. `loading` stays `true` forever → skeleton never resolves.

### Bug 2 — `fetchData` in `Index.tsx` also has no error handling / no `finally`

Same problem in `Index.tsx` lines 123–150: `setLoading(false)` is only called at the very end of the happy path. A network error, a Supabase exception, or a timeout will leave `loading = true` permanently.

```ts
const fetchData = async () => {
  setLoading(true);
  const { data: matchData, error: matchError } = await supabase...  // throws? stuck forever
  ...
  setLoading(false);  // never reached if exception thrown
};
```

### Bug 3 — Module-level `cache` variable in `useSiteConfig` persists across hot reloads

The `let cache: ConfigMap | null = null` at module level means if the site_config fetch ever succeeds, `loading` is initialised to `false` — but if it fails silently once, `cache` stays `null` and every new mount will try to fetch again. On mobile with poor connectivity, the first fetch might simply time out.

---

## The Fix

**`src/hooks/useSiteConfig.ts`** — wrap fetch in try/catch + always call setLoading(false):

```ts
const fetch = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase.from('site_config').select('key, value');
    if (error) throw error;
    if (data) {
      const map: ConfigMap = {};
      data.forEach(row => { map[row.key] = row.value; });
      cache = map;
      setConfig(map);
    }
  } catch (e) {
    console.error('[useSiteConfig] fetch failed:', e);
    // Don't crash — fallbacks will be used from the get() calls
  } finally {
    setLoading(false);  // ← ALWAYS unblock
  }
};
```

**`src/pages/Index.tsx`** — wrap `fetchData` in try/catch + use `finally` for `setLoading(false)`:

```ts
const fetchData = async () => {
  setLoading(true);
  try {
    const { data: matchData, error: matchError } = await supabase...
    if (matchError) console.error('[Index] match fetch error:', matchError);
    if (matchData) {
      setMatch(matchData);
      // ...banner + pricing fetches (also wrapped)...
    }
  } catch (e) {
    console.error('[Index] fetchData error:', e);
  } finally {
    setLoading(false);  // ← ALWAYS unblock, show content or coming-soon
  }
};
```

Additionally add a **timeout safety net** — if both fetches somehow hang beyond 8 seconds, force `loading = false`:

```ts
useEffect(() => {
  const timeout = setTimeout(() => setLoading(false), 8000);
  fetchData().finally(() => clearTimeout(timeout));
}, []);
```

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useSiteConfig.ts` | Add `try/catch/finally` so `setLoading(false)` is always called |
| `src/pages/Index.tsx` | Add `try/catch/finally` to `fetchData`, add 8s timeout safety net |

Two-line root cause summary: both async fetches lack `finally` blocks, so any network hiccup (especially on mobile) silently leaves `loading = true` forever, keeping the skeleton permanently stuck on screen.
