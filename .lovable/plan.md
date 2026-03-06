
## Plan: Premium Landing Page Redesign + Legal Pages

### Overview
This is a substantial redesign of `Index.tsx` plus creation of 4 new legal pages, new routes in `App.tsx`, and a shared `LegalPageLayout` component. The existing Terms.tsx already covers T&C, so it stays. The footer will be a shared component used on the landing page only.

---

### Files to Create
1. `src/components/ui/LandingFooter.tsx` — premium 4-column footer with organiser info, GSTIN, contact, legal links
2. `src/pages/PrivacyPolicy.tsx`
3. `src/pages/RefundPolicy.tsx`
4. `src/pages/EventParticipationTerms.tsx`
5. `src/pages/DisclaimerPolicy.tsx`

### Files to Modify
- `src/pages/Index.tsx` — full redesign
- `src/App.tsx` — add 4 new routes

---

### Landing Page Structure (Index.tsx)

**Top disclaimer bar** — unchanged utility, slightly refined copy

**Hero section** — wider max-w-2xl, spotlight radial behind title, stadium-light corner glows, larger 6xl title, refined subheading & venue badge chip, animated cricket ball emoji with drop-shadow pulse

**Match Highlight Card** — elevated glass variant, red glow border, status badge + match type badge as chips, bigger venue/date rows

**Event Experience Includes** — renamed section, 4 larger cards in 2×2 grid, bigger 3xl icon, stronger hover scale (`hover:scale-[1.03]`), stagger animation

**Pricing Card** — keep existing, add "Group & Family" note more prominently

**Primary CTA** — larger h-16 button, pulsing glow animation via keyframe, "Reserve Your Seats Now" text, secondary link "Already booked? View Your Passes"

**Why Attend trust strip** — 4 inline icon+text trust signals: shield, check-circle, qr-code, star

**Legal Disclaimer** — refined formatting, paragraph-style, softer yellow bar

**LandingFooter** — 4-column responsive grid: About | Legal Info (GSTIN) | Contact | Legal Links

---

### Legal Pages (4 new pages)

All share same structure: BackgroundOrbs, back arrow to `/`, GlassCard sections, gradient header, legal entity "SR LEISURE INN" consistently.

1. **Privacy Policy** (`/privacy`) — data collected (name, mobile, payment proof image), storage, retention, no third-party sale
2. **Refund & Cancellation Policy** (`/refund-policy`) — no refund post-event, organiser-cancellation full refund, 5-day window, hospitality-only fee clarification
3. **Event Participation Terms** (`/event-terms`) — entry rules, conduct, photography, liability waiver
4. **Disclaimer Policy** (`/disclaimer`) — fun game not gambling, no cash prizes, organiser liability limits

---

### Router Changes (App.tsx)
Add 4 new public routes before the `*` fallback:
```
/privacy
/refund-policy
/event-terms
/disclaimer
```

---

### Visual Polish Details
- Hero spotlight: `radial-gradient(ellipse 60% 50% at 50% 0%, hsl(355 80% 55% / 0.12) 0%, transparent 70%)` absolutely positioned behind title
- CTA pulse: add `@keyframes glow-pulse` in index.css with box-shadow oscillation; class `.animate-glow-pulse`
- Feature cards: `transition-transform duration-200 hover:scale-[1.03]` + stagger delay
- Trust strip: `flex flex-wrap justify-center gap-x-6 gap-y-2` row of 4 items with lucide icons (ShieldCheck, BadgeCheck, QrCode, Star)
- Footer columns collapse to 2×2 on mobile (`grid-cols-2 md:grid-cols-4`)
- Max-width expanded to `max-w-2xl` for the landing page to breathe more

---

### New CSS (index.css)
Add `@keyframes glow-pulse` animation for CTA button:
```css
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 24px hsl(355 80% 55% / 0.5); }
  50%       { box-shadow: 0 0 48px hsl(355 80% 55% / 0.85), 0 0 80px hsl(38 75% 52% / 0.3); }
}
.animate-glow-pulse { animation: glow-pulse 2.4s ease-in-out infinite; }
```
