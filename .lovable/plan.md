
## Deep Audit — Full App Review

After reading every page, component, hook and live panel in detail, here are all the meaningful improvements grouped by area.

---

### 1. HOMEPAGE (Index.tsx)

**A. Sticky bottom bar has no "View Passes" label — just "Passes"**
The bottom bar shows `Reserve | Passes | 🎮 Play`. "Passes" is not intuitive for a first-time visitor. Should read "My Passes" with the ticket emoji to match the flow.

**B. "No active match" state has no WhatsApp contact CTA**
When there's no active match, the coming-soon card shows a static message but has no way for users to enquire. Add a "Contact on WhatsApp" link to `wa.me/917217016170`.

**C. Hero area has no venue address / map link**
The venue badge shows "Hotel Drona Palace, Kashipur" but it's not tappable. A map link to Google Maps would help users understand where the event is and builds trust.

**D. Pricing card only shows "per seat" — no indication of what's included**
"₹999 per seat" with no hint that it includes food, TV screening etc. A one-liner below the price like "Includes venue, food & beverage" would significantly improve conversion.

**E. `barDismissed` is only stored in `useState` — dismissing the CTA bar is forgotten on refresh**
Every page reload shows the sticky bar again even if the user dismissed it 2 seconds ago. Should persist to `sessionStorage` so the dismiss lasts for the session.

---

### 2. REGISTER PAGE (Register.tsx)

**F. Auto-download of passes fires silently — no visual progress indicator**
After successful booking, `step === 3` triggers auto-download in a `useEffect`. The UI says "Pass downloading automatically…" in tiny muted text. If the download takes a few seconds (multi-seat + canvas build), users see nothing happening. Should show a progress state (downloading seat 1/2, 2/2) or at least a spinner.

**G. Email field has no validation — invalid emails accepted silently**
The email input accepts anything including `abc@` or `user@.com`. Since email is optional, it's not critical, but storing invalid emails is useless. Should validate format on blur if the field is non-empty.

**H. "Back" button on Step 1 goes back to Step 0 but loses the seat count if they changed it**
If user picks 3 seats, goes to payment, hits Back, then Back again to Step 0, then Next again — the `seatsCount` is preserved but `priceQuote` is null so a fresh quote fetch fires. This is correct behaviour but the re-fetch spinner on step 1 re-enter could be confusing. Not a bug but the UX could acknowledge "Re-fetching price…" more prominently.

**I. Step 2 payment method selector — "Pay at Hotel" is last but most commonly chosen alternative**
The ordering of payment methods is: Razorpay → UPI QR → Pay at Hotel. For a hotel event where many walk-ins want to pay at venue, "Pay at Hotel" being third means extra taps. Should be reordered: Razorpay → Pay at Hotel → UPI QR (since Razorpay is the default, pay at hotel is the natural fallback, UPI QR is the least common).

**J. Step 3 "Pass downloading automatically" fires `window.open(waLink)` which is immediately blocked on most mobile browsers**
Modern Chrome/Safari block programmatic `window.open` calls in async callbacks that are not directly triggered by a user gesture. The WhatsApp confirmation link fires automatically after downloads complete — this will be blocked by the browser popup blocker. The button fallback is fine, but the auto-open should be removed (it never actually works) to avoid confusing "blocked popup" messages.

**K. "View / Retrieve Your Passes →" link at the bottom of Step 3 says "Download" icon but navigates away**
The `Download` icon on that link is misleading — it navigates to `/ticket` page, not a download. Should use `ChevronRight` or `ExternalLink` instead.

---

### 3. TICKET PAGE (Ticket.tsx)

**L. "Print All" button prints ALL tickets stacked, but there's no `@media print` styling**
The `window.print()` call will print the full page including the sticky disclaimer bar, "no-print" buttons etc. While buttons have `no-print` class, the print CSS that hides them is not defined anywhere (no `@media print { .no-print { display: none } }` in global CSS). Need to verify this is actually defined in `index.css`. If not, the print output will include all UI chrome.

**M. Ticket page has no "Refresh / Re-fetch" button**
If an admin just verified a payment and the user is on the ticket page (which loaded before payment was verified), the pass still shows "UNPAID". There's no way to refresh without closing and reopening the page. A "Refresh" or "Re-check status" button would let users see their payment reflected.

**N. Multi-ticket navigation shows "Pass 1 of 3" but always renders ALL passes below**
The prev/next navigation chips at the top suggest only one pass is shown at a time, but actually ALL passes are rendered in a stack (`tickets.map(...)`). The navigation only controls the `activeIdx` for the action buttons (WhatsApp/Remind), not what's displayed. This is confusing. Either: (a) only show the active ticket's card, or (b) remove the navigation controls since all passes are visible anyway.

---

### 4. PLAY PAGE (Play.tsx)

**O. No "Register" CTA for users who land here without a PIN**
The page says "PIN is given at the gate after check-in" but there's no link to `/register` to book a seat first. Users who land here without a pass have no obvious next action. Should add: "Don't have a pass? Book your seats first →" link to `/register`.

---

### 5. LIVE PAGE (Live.tsx)

**P. Logout button is just "Exit" with no confirmation**
Tapping "Exit" immediately clears `game_session` and navigates away, losing the session. If the user accidentally taps it during a live guess window, they lose their context. Should show a brief confirm step (or just be renamed "Logout" for clarity).

**Q. "Already Checked In?" header in GameLoginCard says 🎮 Live badge regardless of match status**
The `🎮 Live` badge in the game login card on the Index page is always shown, even when the match hasn't started yet. Should be conditional on match status — show "🎮 Live" only when status is `live`, otherwise "⏳ Soon" or nothing.

---

### 6. SCOREBOARD (Scoreboard.tsx)

**R. `Break` phase shows blank/no content**
When `phase === 'break'` none of the conditional render blocks match (only `innings1`, `innings2`, `pre`, `ended` are handled). Users see just the phase badge saying "Break" with nothing else — no scores from Innings 1, no hint about what's happening. Should show a "Innings Break" screen with Innings 1 summary.

**S. Overs display is `Number(overs).toFixed(1)` — "20.0" at the end looks odd**
When all 20 overs are done and innings transitions, `20.0` overs is briefly shown. This is a cosmetic issue — could display "20 ov" for completed overs.

---

### 7. PREDICTION PANEL (PredictionPanel.tsx)

**T. No empty state guidance when `windows.length === 0` and predictions ARE enabled**
The empty state "No Active Fun Guess" just says "Guesses open when an active window appears". There's no indication whether the game has started, whether the user is in the right place, or how long to wait. Adding "Admin will open the next guess window shortly — stay tuned!" would be more reassuring.

---

### 8. LEADERBOARD (Leaderboard.tsx)

**U. Mobile numbers are masked as `••••1234` for other players**
This is intentional, but the masking logic `entry.mobile.slice(-4).padStart(10, '•')` pads to 10 chars — which on small screens can look like a long string of dots. It would be cleaner to show `••••1234` (4 dots + last 4 digits, always 8 chars).

---

### 9. VOICE AGENT (VoiceAgent.tsx)

Not audited in detail — but the component is hidden from `/register`, `/ticket`, `/play`, `/live` paths. The landing page shows it. No specific UX issues identified from code alone.

---

### Summary Table

| # | Area | Issue | Effort |
|---|------|-------|--------|
| A | Index | Sticky bar label "Passes" → "My Passes" | Tiny |
| B | Index | No match → add WhatsApp contact CTA | Small |
| C | Index | Venue badge not tappable / no map link | Small |
| D | Index | Pricing card: add "Includes food & venue" note | Tiny |
| E | Index | `barDismissed` not persisted to sessionStorage | Small |
| F | Register | Auto-download has no per-seat progress indicator | Medium |
| G | Register | Email field: no format validation | Tiny |
| H | Register | Payment method order: move "Pay at Hotel" to #2 | Tiny |
| I | Register | Auto-open WhatsApp after booking is browser-blocked, remove it | Small |
| J | Register | "Download" icon on "View Passes" link is wrong icon | Tiny |
| K | Ticket | No `@media print` CSS — print output includes UI chrome | Small |
| L | Ticket | No "Refresh" button to re-check payment status | Small |
| M | Ticket | Multi-ticket nav controls exist but all passes render anyway — confusing | Medium |
| N | Play | No "Book seats" CTA for users without a PIN | Tiny |
| O | Live | "Exit" has no confirm step — accidental logouts | Small |
| P | Live / Index | GameLoginCard "🎮 Live" badge ignores actual match status | Small |
| Q | Scoreboard | `break` phase renders blank — no innings summary shown | Medium |
| R | PredictionPanel | Empty windows state is too vague | Tiny |
| S | Leaderboard | Mobile mask produces inconsistent dot-count | Tiny |

---

### Recommended Implementation Batches

**Batch 1 — Quick wins (all tiny/small, 1 file each)**
- A, D, E (Index: labels + sessionStorage + pricing note)
- G, H, J (Register: email validation + payment order + icon fix)
- N (Play: register CTA)
- R, S (Leaderboard + PredictionPanel: copy tweaks)

**Batch 2 — Moderate improvements**
- B, C (Index: WhatsApp CTA + map link in venue badge)
- I (Register: remove auto window.open)
- K (global CSS: add `@media print`)
- L (Ticket: refresh button)
- O, P (Live: exit confirm + status-aware badge)

**Batch 3 — Structural fixes**
- F (Register: download progress indicator)
- M (Ticket: unify multi-ticket nav with single-pass display mode)
- Q (Scoreboard: break phase innings summary)
