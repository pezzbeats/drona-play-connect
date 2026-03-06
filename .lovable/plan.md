

## Current problem

Lines 90–97 in `Index.tsx` bail out of rendering the whole page:
```tsx
if (loading || configLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```
This causes:
1. Full blank screen → content pop-in (layout shift)
2. The register CTA is invisible during load

## Fix: inline skeleton instead of full-page spinner

Remove the early return entirely. Keep the hero, CTA, footer always rendered. Replace only the **match card section** with a skeleton placeholder while loading.

### What renders during load vs after

```text
DURING LOAD (loading === true)          AFTER LOAD
────────────────────────────────        ────────────────────────────────
Hero (always)                           Hero (always)
┌──────────────────────────┐            ┌──────────────────────────┐
│ ░░░░░░░░  skeleton       │            │  Match card (real data)  │
│ ░░░░░░░░░░░░░░           │      →     │  Features grid           │
│ ░░░░░░                   │            │  Pricing card            │
│ ░░░░ ░░░░ ░░░░ ░░░░     │            │  Trust strip             │
└──────────────────────────┘            └──────────────────────────┘
CTA button (always)                     CTA button (always)
Footer (always)                         Footer (always)
```

### Changes

**`src/pages/Index.tsx`** only:

1. **Remove** the `if (loading || configLoading) { return ... }` early bail-out (lines 90–97)

2. **Add** a `MatchSectionSkeleton` inline component at the top of the file that mirrors the height/structure of the real match section:
   - Banner placeholder: `h-52` pulse div (same height as real banner)
   - Match card skeleton: `p-6` glass card with shimmer lines for title, venue, date
   - 2×2 features grid: four small skeleton cards
   - Pricing card: skeleton with two columns

3. **Replace** `{match ? (...) : (...)}` block with:
   ```tsx
   {(loading || configLoading) ? (
     <MatchSectionSkeleton />
   ) : match ? (
     // real match content
   ) : (
     // coming soon card
   )}
   ```

4. Use the existing `skeleton` CSS class (already defined in `index.css`) for the shimmer effect — consistent with `SkeletonCard` component already in the project.

### Why this is better
- Zero layout shift — page height stays stable during load
- CTA button is immediately visible and tappable even before data loads
- Hero section renders instantly (no waiting for DB)
- Reuses existing `skeleton` CSS class for visual consistency

### Files changed
| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove full-page spinner, add inline `MatchSectionSkeleton`, wire into render logic |

