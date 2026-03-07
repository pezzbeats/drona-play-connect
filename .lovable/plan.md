
## Root Cause — Found

The network log confirms:
- `matches` fetch → 200, returns data correctly
- `match_assets` fetch → 200, returns `[]`  
- `site_config` fetch → **does not appear at all**

This means `useSiteConfig` either: (a) never fires its fetch (stale `cache !== null`), or (b) its fetch is in-flight with `loading = true` permanently stuck.

**The actual bug:** Line 251 in `Index.tsx` gates the entire match section on **both** `loading` AND `configLoading`:

```tsx
{(loading || configLoading) ? (
  <MatchSectionSkeleton />
```

`site_config` data is purely cosmetic text with fallbacks for every single key. There is zero reason to block the match section on whether site config has loaded. If `configLoading` gets stuck (network miss, cache race, etc.), the skeleton stays forever — even when `loading` (match data) is already `false`.

**Fix**: Remove `configLoading` from the skeleton condition. The match section should render as soon as match data is ready. Config text has hardcoded fallbacks (`get('hero_title', 'T20 Fan Night')`) so it renders perfectly without waiting for DB.

Also fix `useSiteConfig` to never start in `loading = true` when `cache` is null on first mount — initialise it as non-blocking so it doesn't hold up the page.

## Changes

### `src/pages/Index.tsx`
- Line 251: Change `{(loading || configLoading) ?` → `{loading ?`
- That's the only change needed here

### `src/hooks/useSiteConfig.ts`
- Change `loading` initial state from `!cache` to always `false`
- The hook will fetch in background and update config text, but never block rendering
- All `get()` calls have fallbacks so content is immediately visible

```ts
// Before:
const [loading, setLoading] = useState(!cache);

// After:
const [loading, setLoading] = useState(false);
```

This makes `configLoading` always `false` on mount, so it can never block the page. The fetch still runs in background and updates text once loaded.

## Why this is the correct fix

The `site_config` data contains display text (hero title, subtitles, feature labels). Every single `get()` call in Index.tsx has a hardcoded fallback string. There is no functional need to wait for this data before showing the page — the fallbacks are production-quality text. Blocking the page on it was always wrong; this removes that coupling entirely.

## Files Changed
| File | Change |
|---|---|
| `src/hooks/useSiteConfig.ts` | Set initial `loading` state to `false` so it never blocks consumers |
| `src/pages/Index.tsx` | Remove `configLoading` from skeleton gate condition — match data alone controls skeleton |
