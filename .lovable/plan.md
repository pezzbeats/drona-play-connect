
## Overview

10 polish prompts grouped into 5 implementation batches. I'll tackle them in priority order — UX-critical first, then performance, then legal/marketing.

---

## Batch 1 — Prompt 11: Registration UX Polish (`src/pages/Register.tsx`)

**Current issues:**
- Step labels hidden on mobile (`hidden sm:block`)
- No inline field validation (only on submit)
- Payment section lacks visual hierarchy — UPI QR and Pay at Hotel look identical
- Step 3 (tickets) shows QR small (90px) and no prominent payment status badge
- No eligibility/status feedback after pricing quote loads
- No CTA prominence when tickets are ready

**Changes:**
- **Inline validation**: real-time `border-destructive` on mobile field as user types (not yet 10 digits), name field (empty check), live character count helper
- **Progress bar**: replace dot indicators with a full horizontal progress bar with step labels always visible (vertical stack on mobile-friendly layout)
- **Sections as distinct cards** with clear numbered headings: `①`, `②`, etc.
- **Payment section redesign**:
  - UPI QR: large highlighted card with green border, "Recommended — instant verification" subtitle
  - Pay at Hotel: amber/warning card with "Book now, pay at venue" subtitle
  - After method selection: show prominent total with bigger font
- **Ticket CTA**: green pulsing "Your Tickets are Ready! 🎟️" banner at top of step 3, QR size increased to 140px, prominent `PAID ✓` or `PAY AT HOTEL` badge centered in card
- **Mobile-specific**: `inputMode="numeric"` on mobile field, `autoFocus` on first field on mount

---

## Batch 2 — Prompt 13: Ticket/Pass UI Polish (`src/pages/Ticket.tsx`)

**Current issues:**
- QR is only 110px — borderline scannable
- No prominent PAID/UNPAID banner
- No seating type shown
- Card stack for multiple tickets is plain `space-y-4` (no visual elevation or divider)
- Print layout is raw

**Changes:**
- **QR**: increase to `150px`, add white padding, visible border-glow for paid tickets
- **Payment banner**: full-width colored banner at top of each card: `PAID — Entry Confirmed ✅` (green) or `UNPAID — Pay at Hotel on Arrival ⚠️` (amber) — large, unmissable
- **Card header**: add decorative top gradient strip color-coded by payment status
- **Ticket numbering**: "SEAT 1 of 3" style with large display font
- **Carousel/stack indicator**: when multiple tickets, add "← swipe or scroll for more →" hint and subtle drop-shadow stack effect behind cards
- **Print CSS**: improved `@media print` layout — black border, PAID stamp, large QR

---

## Batch 3 — Prompt 12: Admin UX Polish (`src/pages/admin/AdminValidate.tsx` + `AdminControl.tsx`)

**AdminValidate changes:**
- **Sticky top action bar**: when a ticket is loaded and checked in, show a sticky `✅ CHECKED IN — [Name]` green strip at top of page so gate staff see result at a glance without scrolling
- **Larger buttons on mobile**: Check-in button increased to `h-14` (`size="xl"` or explicit class), payment method buttons use `min-h-[60px]`
- **Quick summary chips** at the top: `✅ Paid` / `❌ Unpaid` / `🔄 Pending` shown as large colored pills right below the scan result name
- **Confirmation modal for Reissue QR**: currently fires immediately — wrap in `AlertDialog` with "This will invalidate the current QR code" warning
- **Error state improvement**: current "not found" is just a toast — add inline error card below scan zone showing `❌ Ticket Not Found` with suggestion to try again

**AdminControl changes:**
- **Confirmation modals** (using `AlertDialog`) for:
  - `End Match` (phase = `ended`)
  - `End Innings` (phase = `break` or `innings2`)
  - Freeze Predictions / Freeze Scanning (already has reason textarea — add confirm button)
- **Sticky action summary bar** at page top showing: current phase badge, over number, balls in over (e.g. `Over 5 · Ball 3/6`), active window status
- **Phase buttons**: add visual hierarchy — active phase gets distinct highlight ring, dangerous phases (`ended`) stay `danger` but require extra confirm

---

## Batch 4 — Prompt 16 + 17: Legal Safety Layer

**Prompt 16 (Language + Disclaimers):**

Files: `src/pages/Live.tsx`, `src/components/live/PredictionPanel.tsx`, `src/components/live/Leaderboard.tsx`, `src/pages/Register.tsx`

- Replace "prediction" label in PredictionPanel with "Fun Guess" and tab label `🎯 Guess`
- Add persistent disclaimer card in PredictionPanel: "This is a fun guess game for entertainment only. No betting or wagering." as a non-removable amber box
- Leaderboard: subtitle "Fun participation rankings — no cash prize, entertainment only"
- Register page: disclaimer below payment section "All fees are for event hospitality only. The guess game is free to play."

**Prompt 17 (Terms integration):**

New file: `src/pages/Terms.tsx` — a clean glass-styled terms page with 4 sections:
1. Event Entry Terms
2. Payment & Refund Terms
3. Payment Proof Verification Terms
4. Fun Guess Game Disclaimer

Add route `/terms` in `App.tsx`.

In `Register.tsx` step 0: add "By continuing, you agree to our [Event Terms]" link (small text, no blocker checkbox — clean).
In `Ticket.tsx`: add "View Event Terms" link in footer.

No admin terms PDF upload feature (out of scope for UX-only pass — that's schema work).

---

## Batch 5 — Prompt 18: Public Landing Page (`src/pages/Index.tsx`)

**Current state**: `Index.tsx` is literally the Lovable placeholder page.

**New `Index.tsx`** — full premium event microsite:

```
┌─────────────────────────────────────────┐
│  T20 FAN NIGHT  [gradient hero text]    │
│  Hotel Drona Palace                     │
│  [MATCH BANNER IMAGE if active]         │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ 🏏 Match Title · vs Opponent    │   │
│  │ 📍 Venue · 📅 Date/Time         │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [What's Included section]             │
│  🏟️ Live Match · 🎯 Fun Guess Game    │
│  🍽️ F&B · 🏆 Leaderboard             │
│                                         │
│  [Pricing summary card]                │
│  Regular · Family pricing              │
│                                         │
│  [REGISTER NOW →] large CTA button     │
│                                         │
│  [Fun Guess Game Disclaimer footer]    │
└─────────────────────────────────────────┘
```

Fetches active match + banner from DB. If no active match: premium "Next event coming soon" card.

---

## Prompts 14, 15, 19, 20 — Deferred

- **Prompt 14/15** (performance): Requires profiling data before optimizing. Better addressed as a dedicated pass after UX polish.
- **Prompt 19** (WhatsApp promo cards): Standalone feature, addressed separately.
- **Prompt 20** (Admin preview mode): Already partially built (preview mode exists in `Register.tsx` via `?preview=matchId`). Full preview mode is a dedicated feature.

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Register.tsx` | Inline validation, payment section redesign, progress bar, prominent ticket CTA, disclaimer link |
| `src/pages/Ticket.tsx` | Large QR (150px), payment banner, card stack polish, print improvements |
| `src/pages/admin/AdminValidate.tsx` | Larger touch targets, sticky result bar, confirmation modal for Reissue QR, inline error card |
| `src/pages/admin/AdminControl.tsx` | Confirmation dialogs for end match/innings/freeze, sticky phase status bar |
| `src/pages/Live.tsx` | Tab label "Guess", persistent disclaimer, improved header |
| `src/components/live/PredictionPanel.tsx` | Disclaimer box, "Fun Guess" language, improved option buttons |
| `src/components/live/Leaderboard.tsx` | Legal subtitle, "entertainment only" framing |
| `src/pages/Terms.tsx` | New terms page (4 sections) |
| `src/pages/Index.tsx` | Full premium landing page with active match data |
| `src/App.tsx` | Add `/terms` route, update `/` route handling |

No DB schema changes. No edge function changes. Pure UX/presentation polish.
