
## Mobile-First Transformation Plan

### Current State Assessment
- **AdminLayout**: Uses a fixed left sidebar (`w-60` / `w-16`) — completely unusable on phones, pushes content with `ml-60`
- **Live.tsx**: Tab labels hidden on mobile (`hidden sm:inline`), reasonable but can be improved
- **Register.tsx**: Already has a step bar and cards, but vertical flow can be tightened
- **AdminControl.tsx**: 873 lines of dense form-heavy UI, not optimized for mobile touch
- **AdminValidate.tsx**: 747 lines — the most critical mobile screen, needs biggest lift
- **AdminDashboard**: `p-6 space-y-6` desktop padding, `grid-cols-2 lg:grid-cols-3` stat grid
- **Ticket.tsx**: Reasonable but scrolling card stack needs carousel feel on mobile

### Strategy: Two separate concerns

**1. Admin area** — needs a full navigation paradigm shift:
- On mobile: hide the left sidebar entirely, show a **bottom nav bar** with the 4-5 most used items + hamburger drawer for the rest
- On desktop (md+): keep existing sidebar behavior
- This is the single biggest UX win for the whole admin side

**2. Public pages** (Register, Ticket, Play, Live, Index) — already max-w-lg centered, just need polish:
- Safe-area padding, font sizing, input zoom prevention (`text-[16px]`), better tap targets

---

## Files to Change

| File | Change |
|---|---|
| `src/components/admin/AdminLayout.tsx` | Mobile bottom nav + hamburger drawer; sidebar only on `md+` |
| `src/components/admin/AdminSidebar.tsx` | Make it `md+` only (hidden on mobile); extract nav items to shared const |
| `src/components/admin/AdminBottomNav.tsx` | **New** — mobile bottom tab bar (5 key items) |
| `src/pages/admin/AdminDashboard.tsx` | Mobile-safe padding, tighter quick-action cards |
| `src/pages/admin/AdminValidate.tsx` | Larger touch targets, full-screen scan zone feel, sticky result strip |
| `src/pages/admin/AdminControl.tsx` | Sticky status bar, collapsible sections, larger buttons |
| `src/pages/admin/AdminOrders.tsx` | Cards instead of table rows on mobile |
| `src/pages/admin/AdminManualBooking.tsx` | Full-width inputs, proper mobile form flow |
| `src/pages/Register.tsx` | `text-[16px]` on inputs (prevent zoom), safe-area bottom padding |
| `src/pages/Play.tsx` | Center-pinned, safe-area aware |
| `src/pages/Live.tsx` | Bottom-sticky tab bar replacing top tabs, full-height panel |
| `src/pages/Ticket.tsx` | Swipeable-feel carousel cards, safe-area padding |
| `src/index.css` | Mobile base: `font-size: 16px` on inputs, safe-area vars, touch-callout none |

---

## Key Implementation Details

### AdminLayout + Bottom Nav (biggest change)

```
Mobile (< md):
┌─────────────────────────────────┐
│   Page Content (full width)     │
│   safe-area top padding         │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│  🏠  📋  📷  📚  ☰            │  ← bottom nav bar (56px + safe-area)
└─────────────────────────────────┘

Desktop (md+):
┌──────┬──────────────────────────┐
│Sidebar│   Page Content          │
│ w-60  │                         │
└──────┴──────────────────────────┘
```

`AdminBottomNav.tsx`:
- 5 slots: Dashboard · Validate (primary, highlighted) · Orders · Control · More (opens Sheet drawer with remaining nav items)
- Active route highlighted with crimson bg pill
- Uses `pb-safe` (safe area inset bottom) — via CSS env variable
- `fixed bottom-0 z-50` 

`AdminLayout.tsx`:
- On mobile: `ml-0`, `pb-16` (space for bottom nav), no sidebar
- On desktop `md:ml-60`: sidebar + no bottom nav

### Live.tsx — Bottom Tab Bar

Move the `score / predict / leaderboard` tabs from the top header area to a **sticky bottom bar**. This frees up the full viewport for content and keeps navigation thumb-reachable.

```
┌─────────────────────────────┐
│  Match name · mobile · Exit │  ← compact fixed header
├─────────────────────────────┤
│                             │
│     Tab content area        │
│     (scrollable)            │
│                             │
├─────────────────────────────┤
│  📊 Score  🎯 Guess  🏆 LB  │  ← fixed bottom tabs
└─────────────────────────────┘
```

### Input zoom prevention

In `index.css` and all input fields: ensure `font-size: 16px` minimum so iOS Safari doesn't auto-zoom. Add to `.glass-input`:
```css
font-size: 16px; /* prevent iOS zoom */
```

### Safe-area padding

Add to `index.css`:
```css
.safe-top    { padding-top:    env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.pb-safe     { padding-bottom: calc(4rem + env(safe-area-inset-bottom)); }
```

### AdminOrders mobile cards

Current: expandable rows, expand button `<ChevronDown>`. Works on desktop.  
Mobile: each order renders as a `GlassCard` with status badge, name, amount, and an expand chevron — readable at a glance without horizontal scroll.

### AdminValidate — full-screen scan feel

- Input field takes full width, `text-[16px]`, large `h-14`
- After scan: result card slides up as a bottom sheet feel (fixed bottom panel on mobile)
- Checkin button `h-16 text-lg w-full`

---

## Scope Note

**Not changing:** AdminControl's core form logic (873 lines) — it will get mobile padding/sizing fixes but the full delivery form refactor is a separate pass to avoid breaking the complex state machine.

**Not changing:** Any backend, edge functions, database, or business logic.
