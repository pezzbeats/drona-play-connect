
## Assessment

The current codebase has a solid cricket-green/crimson/gold theme in CSS variables, but several visual quality gaps remain:

1. **`index.css`** — CSS variables are correct but missing: `--info` color token, `--success-bg`/`--warning-bg` surface tokens, typography scale variables, and `line-height` refinements. The `.glass-card` has no `transition`, no elevation variants. `.badge-*` classes are functional but lack `letter-spacing` and `font-size` polish.

2. **Skeleton/loading states** — All loading states use a bare `<Loader2 animate-spin>` spinner. No skeleton cards exist anywhere.

3. **Empty states** — Plain "No orders found" text in a card with no icon/description. No visual hierarchy in empty states.

4. **`StatusBadge.tsx`** — Works but all badges are the same shape/size. No dot indicator for live status, no gradient micro-accents.

5. **`BackgroundOrbs`** — Good but could use a fifth very subtle deep-green "outfield" orb on the public pages for more depth.

6. **`AdminMatches.tsx`** — `p-6 space-y-6` — not mobile-padded. Empty state icon is `text-muted-foreground` — too dull.

7. **`AdminDashboard.tsx`** — Stat cards look good but loading state is a full-height spinner. Quick action cards have no `active:scale-95` press animation.

8. **`AdminOrders.tsx`** — Expanded proof section uses raw `bg-green-500/20 text-green-400` — hardcoded non-theme colors. Loading is a bare spinner.

9. **`Register.tsx`** — Step bar looks good. Form inputs use the standard `<Input className="glass-input">` but the first step still has basic `border-input bg-background` base styling. No inline success tick on valid mobile.

10. **Typography** — H1-H4 already use `Rajdhani`. But body copy line-height, label sizing, and number display (scores, amounts) are not consistently styled as a system.

11. **`Live.tsx` bottom tab bar** — Tab active state is only `text-primary` + small bg pill. Could be more premium with a top border indicator like iOS tab bars.

12. **Motion** — `active:scale-[0.97]` only on `GlassButton`. Cards have no entrance animation. No `animate-fade-in` on page mount.

## Plan

### Files changed: 9

---

### 1. `src/index.css` — Design token & global polish upgrade
- Add `--info: 210 60% 55%` token
- Add `--surface-1` / `--surface-2` tokens for card elevation hierarchy (`hsl(355 20% 9%)` and `hsl(355 18% 11%)`)
- Add `--radius-sm: 0.5rem`, `--radius-lg: 1rem`, `--radius-xl: 1.25rem`
- Improve `body` line-height to `1.6`
- Add heading `line-height: 1.15` and `letter-spacing: 0.015em` globally
- Add `.glass-card` `transition: box-shadow 0.2s, border-color 0.2s` and `hover:border-border/40` affordance
- Add `.glass-card-elevated` — slightly lighter surface + stronger shadow for modals/sheets
- Refine `.badge-*` classes: add `letter-spacing: 0.04em`, `font-size: 0.7rem`, `padding: 2px 10px` for cleaner pill shape
- Add `.badge-live` with animated pulse dot: `::before { content:''; width:6px; height:6px; border-radius:50%; background:currentColor; animation:pulse 1.5s infinite; margin-right:5px; display:inline-block; }`
- Add `.skeleton` utility: `bg-muted/40 animate-pulse rounded-lg`
- Add `.stat-number` typography class: `font-display text-4xl font-bold tabular-nums leading-none tracking-tight`
- Add `.section-title` typography class: `font-display text-sm font-bold uppercase tracking-widest text-muted-foreground`
- Add `@keyframes slide-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }` + `.animate-slide-up { animation: slide-up 0.35s ease-out; }`
- Add `@keyframes count-in { 0% { opacity:0; transform:scale(0.8); } 100% { opacity:1; transform:scale(1); } }` + `.animate-count-in { animation: count-in 0.25s ease-out; }`

---

### 2. `src/components/ui/StatusBadge.tsx` — Premium badge refinement
- Add live/active pulse dot using `::before` via an `is-live` flag or by adding a `badge-live` class to the `live` status config
- Change `live` badge to use new `badge-live` class with a `<span>` dot before the label
- Update all badge classNames to include `px-3 py-1 rounded-full text-[0.7rem] tracking-wider`
- Use a `dot` indicator for `live` status: render `<span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5 inline-block" />` before "Live" text

---

### 3. `src/components/ui/GlassCard.tsx` — Elevation variants
- Add `variant` prop: `'default' | 'elevated' | 'sunken'`
- `elevated`: uses `glass-card-elevated` class (slightly lighter bg + stronger shadow) for modals, hero cards
- `sunken`: uses lower opacity background for inner-card use
- Add `animate` prop (boolean): applies `animate-slide-up` on mount

---

### 4. `src/components/ui/SkeletonCard.tsx` — New component
Create a new reusable skeleton card component:
```tsx
// Used when data is loading — replaces bare Loader2 spinners
export const SkeletonCard = ({ lines = 3, showAvatar = false }) => (
  <div className="glass-card p-4 space-y-3 animate-pulse">
    {showAvatar && <div className="w-10 h-10 rounded-xl skeleton" />}
    {Array.from({length: lines}).map((_, i) => (
      <div key={i} className={`h-4 rounded skeleton ${i === lines-1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
)
```

---

### 5. `src/pages/admin/AdminDashboard.tsx` — Skeleton + polish
- Replace `<Loader2>` loading state with `<SkeletonCard>` grid (6 skeleton stat cards at `grid-cols-2 sm:grid-cols-3 gap-3`)
- Add `animate-slide-up` to stat cards on load (use `[style={{ animationDelay: `${i * 0.05}s` }}]`)
- Add `active:scale-95` to quick action card links
- Stat number: apply `stat-number` class
- Add a `.section-title` label above Quick Actions: "QUICK ACTIONS"

---

### 6. `src/pages/admin/AdminOrders.tsx` — Theme color fix + skeleton + empty state
- Replace hardcoded `bg-green-500/20 text-green-400` / `bg-yellow-500/20 text-yellow-400` / `bg-red-500/20 text-red-400` with theme tokens: `bg-success/20 text-success` / `bg-warning/20 text-warning` / `bg-destructive/20 text-destructive`
- Replace loading spinner with skeleton list (5 `<SkeletonCard>` items)
- Replace empty state `<p>No orders found</p>` with proper empty state:
  ```tsx
  <GlassCard className="p-10 text-center">
    <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
    <p className="font-display text-lg font-bold text-foreground">No orders found</p>
    <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filter</p>
  </GlassCard>
  ```

---

### 7. `src/pages/admin/AdminMatches.tsx` — Mobile padding + empty state + polish
- Change `p-6 space-y-6` → `px-4 py-5 space-y-5 max-w-2xl mx-auto md:max-w-none md:p-6` (mobile-safe, consistent with dashboard)
- Replace empty state icon color: `text-muted-foreground` → `text-primary/30` with better copy
- Loading: replace spinner with 3 skeleton cards
- Active match card: add `animate-pulse-glow` subtle border animation on the `is_active_for_registration` match
- Replace loading spinner with `<SkeletonCard lines={2} />` × 3

---

### 8. `src/components/live/Scoreboard.tsx` — Score number polish
- Apply `stat-number` class (or equivalent `font-display text-6xl font-bold tabular-nums`) to the main score display
- Add `animate-count-in` class when score changes (use a `useEffect` + ref trick to add/remove class on value change)
- Add subtle divider between the score area and player strip

---

### 9. `src/pages/Index.tsx` — Animate-on-mount polish
- Wrap the main content div in `animate-fade-in`
- Add `animate-slide-up` with staggered delays to the feature cards grid
- Add `[delay-100]` variants on FEATURES cards
- Improve the "Coming Soon" empty state: add a proper illustrative layout with feature list

---

## Non-changes
- No backend, logic, database, or routing changes
- `GlassButton.tsx` — already fixed in prior session (crimson/gold glows, h-14 lg)
- `AdminBottomNav`, `AdminSidebar`, `AdminLayout` — already optimized
- `Live.tsx` bottom tab bar — already correct
- `Register.tsx`, `Play.tsx`, `Ticket.tsx` — not changing (already improved in prior sessions)
- `AdminValidate.tsx`, `AdminLogin.tsx`, `AdminManualBooking.tsx` — already improved

## File Summary

| File | Type |
|---|---|
| `src/index.css` | Token upgrade, badge polish, skeleton, slide-up animation |
| `src/components/ui/StatusBadge.tsx` | Live dot, better pill sizing |
| `src/components/ui/GlassCard.tsx` | Elevation variant + animate prop |
| `src/components/ui/SkeletonCard.tsx` | New skeleton loading component |
| `src/pages/admin/AdminDashboard.tsx` | Skeletons, stat-number, slide-up stagger |
| `src/pages/admin/AdminOrders.tsx` | Theme color fix, skeleton, empty state |
| `src/pages/admin/AdminMatches.tsx` | Mobile padding, skeleton, empty state |
| `src/components/live/Scoreboard.tsx` | Score number polish, count-in animation |
| `src/pages/Index.tsx` | Animate-on-mount, staggered cards |
