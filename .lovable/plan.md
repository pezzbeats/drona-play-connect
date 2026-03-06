
## Current State Assessment

After reading all key files, here's an accurate picture of what already exists vs. what needs improvement:

**Already good:**
- `AdminBottomNav.tsx` — well-built with drawer, role filtering
- `AdminSidebar.tsx` — desktop-only (`hidden md:flex`), correct
- `AdminLayout.tsx` — correct mobile/desktop split
- `AdminDashboard.tsx` — already 2-col grid, mobile padding
- `AdminOrders.tsx` — already card-based with expand/collapse
- `Play.tsx` — already h-14 inputs, safe-area aware
- `Live.tsx` — already has bottom tab bar

**Actual problems found:**

1. **`GlassButton`** — `primary` variant still has hardcoded blue hover glow: `hover:shadow-[0_0_30px_hsl(210_100%_56%/0.6)]` and `accent` variant has purple: `hover:shadow-[0_0_20px_hsl(265_80%_65%/0.5)]` — leftover from old theme
2. **`Register.tsx` Step 2** — seat selector is too small (`h-8` ghost buttons for +/−), not thumb-friendly
3. **`Register.tsx` Step 2 (Payment)** — UPI QR section needs better mobile visual hierarchy; the UPI QR flow is complex and visually dense on mobile
4. **`Scoreboard.tsx`** — The main score display (`text-5xl`) is good but the player grid is `grid-cols-3` with very small cells that break on narrow phones
5. **`PredictionPanel.tsx`** — Option buttons are `p-2.5` which is borderline too small for comfortable tapping
6. **`Leaderboard.tsx`** — Mostly fine but rank icons for positions 4+ use `text-xs` plain numbers — could be more premium
7. **`AdminValidate.tsx`** — Scan input and check-in UI is quite good already but the **gate payment collection section** uses very small `text-sm` button rows that need larger tap targets
8. **`AdminLogin.tsx`** — Login form is fine but CTA button is `size="lg"` using `h-12` — could be `h-14` for more premium feel
9. **`AdminManualBooking.tsx`** — The form inputs need consistent `h-12 text-base` sizing
10. **`tailwind.config.ts`** — May have `glow-cyan` or other legacy color references
11. **`index.css`** — The `body` background stripe pattern and glass-card styles are correct. The `.glass-input` might still have issues on some variants.

## Targeted Changes

### 1. `src/components/ui/GlassButton.tsx`
- Fix `primary` hover: replace blue `hsl(210 100%...)` → crimson `hsl(355 80% 55% / 0.6)`
- Fix `accent` hover: replace purple `hsl(265 80%...)` → gold `hsl(38 75% 52% / 0.5)`
- Increase `sm` size from `h-8` to `h-9` for better tap targets
- Increase `lg` size from `h-12` to `h-14` for premium feel

### 2. `src/pages/Register.tsx`
- Seat counter: make +/− buttons `h-12 w-12` with larger text
- Seating type selector: increase card padding to `p-4` for more tappable area
- Step 2 payment: increase UPI QR section spacing, add better visual section breaks
- CTA button: make it `h-14` full-width sticky feel
- File upload button: make it `h-14 w-full` proper upload zone

### 3. `src/components/live/Scoreboard.tsx`
- Player name grid: change from `grid-cols-3 gap-2` to a more spacious layout on narrow phones using `grid-cols-1 sm:grid-cols-3` or a horizontal scroll strip
- Score display: Add a subtle animated ring/flash border on update

### 4. `src/components/live/PredictionPanel.tsx`
- Option buttons: increase from `p-2.5` to `p-3.5 min-h-[48px]` for thumb-friendly tapping
- Submit button: make full `h-12`
- Resolved/locked window cards: improve visual hierarchy with better opacity treatment

### 5. `src/components/live/Leaderboard.tsx`
- Row height: ensure `py-3.5` minimum for all entries (currently `py-2.5`)
- Top 3 ranks: add colored backgrounds (gold/silver/bronze tints)
- "You" highlight: increase visual differentiation

### 6. `src/pages/admin/AdminValidate.tsx` (gate collect section)
- Payment method selector buttons: increase to `h-14` each with better icon sizing
- Collect amount input: ensure `h-14 text-lg`
- The Collect button: `h-14 w-full text-base`

### 7. `src/pages/admin/AdminLogin.tsx`
- Input fields: `h-14 text-base` 
- Submit button: `h-14`
- Better spacing between form elements

### 8. `src/pages/admin/AdminManualBooking.tsx`
- All inputs: `h-12 text-base`
- Search button: `h-12`
- Action buttons full-width on mobile

### 9. `src/index.css`
- Add a `min-h-[44px]` touch-target utility class
- Ensure `.glass-input` always has `min-height: 48px`
- Add smooth `transition-all duration-200` to `.glass-card` for hover states

### 10. `tailwind.config.ts`
- Check/fix any remaining legacy color references in glow/gradient utilities

## Files to Change

| File | Scope |
|---|---|
| `src/components/ui/GlassButton.tsx` | Fix blue/purple hover glows → crimson/gold; increase tap targets |
| `src/pages/Register.tsx` | Larger seat counter, bigger upload zone, `h-14` CTAs |
| `src/components/live/Scoreboard.tsx` | Responsive player grid, enhanced score flash |
| `src/components/live/PredictionPanel.tsx` | Bigger option tap targets, improved resolved state |
| `src/components/live/Leaderboard.tsx` | Better row height, top-3 highlight, improved "you" marker |
| `src/pages/admin/AdminValidate.tsx` | Larger gate collect buttons and inputs |
| `src/pages/admin/AdminLogin.tsx` | `h-14` inputs and CTA |
| `src/pages/admin/AdminManualBooking.tsx` | `h-12` inputs, better form spacing |
| `src/index.css` | Touch-target utilities, glass-input min-height |

**Not changing:** All business logic, backend calls, realtime subscriptions, state management, routing, auth, database, edge functions — zero changes.

**Scope kept tight:** AdminControl (873 lines — complex delivery state machine, skip), AdminOrders (already card-based, good), AdminDashboard (already mobile-optimised), AdminSidebar/AdminBottomNav (already correct), Live.tsx (already has bottom tab bar), Play.tsx (already h-14 inputs).
