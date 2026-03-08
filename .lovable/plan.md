
## Remaining Enhancement Opportunities — Deep Audit Round 2

After reading every page and component, here are the remaining opportunities that haven't been fixed yet, grouped by value.

---

### BATCH A — Tiny/Quick Wins (1–5 line changes each)

**A1. Register Step 3: "View / Retrieve Your Passes →" still uses `ChevronRight` icon instead of the planned fix**
Line 1749 of Register.tsx: `<ChevronRight className="h-4 w-4" />` — this was changed from `Download` to `ChevronRight` but the plan said to use `ExternalLink`. `ChevronRight` is actually fine but the icon import `Download` is still imported (line 14) and no longer used for this button. Minor cleanup.

**A2. Register Step 3 "downloading" progress message is off-by-one**
Line 1523: `Downloading pass {downloadProgress.done + 1} of {downloadProgress.total}…` — `done` is the count of *completed* downloads, not the in-progress one. When `done=0`, it says "Downloading pass 1 of 2" (correct). When `done=1`, it says "Downloading pass 2 of 2" (correct). After the loop finishes it sets `downloadProgress(null)` so the message disappears. This is actually correct — but the UX could show `✓ All N passes downloaded` for 1 second before clearing, so the user sees definitive confirmation.

**A3. Scoreboard "overs" display: `Number(overs).toFixed(1)` shows "20.0" at max overs**
Line 313: `{Number(overs).toFixed(1)} overs`. When overs = 20, shows "20.0 overs". Better: `{Number(overs) === Math.floor(Number(overs)) ? Math.floor(Number(overs)) : Number(overs).toFixed(1)} overs` — shows "20 overs" for complete-over values, "12.3 overs" for partial ones. Same issue at line 220, 279, 284.

**A4. Ticket page: "Questions? Contact hotel reception." is generic**
Line 952: Should be a tappable `tel:` link — `<a href="tel:7217016170">`. This is 1-line change.

**A5. Live page "No Active Match" state lacks a redirect back to home**
Lines 277-285 in Live.tsx: The "No Active Match" card inside LivePage only has "Back to Login" which goes to `/play`. Should also have a "Go to Home" link for users who want to re-register.

**A6. PredictionPanel: empty state copy improvement is still at the old generic text**
Looking at line ~230 in PredictionPanel.tsx — need to check if the previous audit's copy change was implemented. Looking at current code, the empty windows state (when windows.length === 0 and not frozen) shows `"No Active Fun Guess"` / `"Guesses open when an active window appears"`. The planned improvement was to add "Admin will open the next guess window shortly — stay tuned!" This needs verification/implementation.

**A7. Register Step 0: "Continue" button is disabled if name is empty, but there's no placeholder/example hint**
No example name shown. Could add `placeholder="e.g. Rajesh Kumar"` for clarity. Single attribute change.

**A8. Index page: The sticky bottom bar CTA "Reserve" has no seat count context**
The sticky bar just says "Reserve →" — no price hint. Since pricing is loaded, could show "Reserve ₹999+" if pricing is available. Small enhancement.

---

### BATCH B — Moderate (UX improvements)

**B1. Register: "Pay at Hotel" info box says "Passes marked Unpaid. Pay the full amount at the venue before entry."**
This is slightly scary for a user who wants to confirm their booking. Better copy: "Your seat is reserved. Pay ₹{total} cash/UPI at hotel on arrival before entry." This reassures the user the booking IS confirmed, just payment is deferred.

**B2. Ticket Page: Balance reminder button is only shown for admin users (`isAdmin && !paidTickets`)**
Lines 896-910 and 942-946: The balance reminder/WhatsApp link on each pass card is gated behind `isAdmin`. Regular users also need a way to share their balance reminder with the hotel on WhatsApp. The "Send Balance Reminder" button in PassCard (`hasBalance && onRemind`) is only triggered for admins. Non-admin users with an unpaid ticket have NO WhatsApp balance option. Should show the reminder to all users, not just admins.

**B3. Live page: "Exit" button label is still "Exit" even after exit confirm dialog was added**
Looking at line 133: `onClick={() => setShowExitConfirm(true)}`. The exit confirm dialog WAS added. But the button still just says "Exit" with no visual cue it needs confirmation. A small `LogOut` icon would improve discoverability. The previous plan noted this was done but the label could be improved.

**B4. Leaderboard: Mobile mask `••••${entry.mobile.slice(-4)}`**
Line 231: `{entry.player_name || \`••••${entry.mobile.slice(-4)}\`}`. If `player_name` is null/empty, shows `••••1234` — this is 8 chars total which is good. ✅ This was already fixed in the previous round.

**B5. PredictionPanel: No "score" shown after a window is resolved — only "+10 pts ✓" or "0 pts ✗"**
Users want to know their running total without switching to the Leaderboard tab. Could show a small score banner at the top of the PredictionPanel: "Your total: 30 pts — 3/5 correct" — fetched once when the component mounts.

**B6. GameLoginCard on Index: PIN field has no `onKeyDown` Enter handler**
Lines 111-119: The PIN input doesn't have `onKeyDown={e => e.key === 'Enter' && handleLogin()}`. Users typing the PIN on a physical keyboard (or iOS smart keyboard) have to tap the button. Mobile keyboards may show a "Go" key that should trigger login.

**B7. Register: name input has no `onKeyDown` Enter handler to advance to the mobile field**
Line 1110: `<Input ref={nameRef} ...>` — no Enter handler. After typing name, Enter should focus mobile field, not submit. After mobile is valid + Enter → advance.

---

### BATCH C — Structural/Bigger

**C1. Register page: The "lastBooking" success state was implemented for AdminManualBooking but the Register page (public) still auto-opens WhatsApp**
Looking at lines 1709-1719: Register step 3 has the WhatsApp button as a manual-click button (`window.open(buildConfirmationWALink(), '_blank')` on click). The previous audit said to remove the **auto** window.open, which was done. The button is correct and user-initiated. ✅ This is already fixed.

**C2. Register page resets to Step 0 if the user navigates away and back (no sessionStorage save)**
If a user is on Step 2 (payment) and accidentally hits browser back, then forward, the entire form is gone. Could save `{fullName, mobile, email}` to sessionStorage on Step 1 advance and restore on mount. This would prevent accidental data loss.

**C3. Index page: No structured data / meta tags for social sharing**
No `<meta property="og:title">` / `<meta property="og:description">` etc. in `index.html`. When users share the URL on WhatsApp it shows a blank preview. Adding Open Graph tags would make the link preview rich. This is a one-time `index.html` edit.

**C4. Ticket page: The `Print` button prints only the active ticket on-screen but print CSS shows ALL tickets**
Line 933: `className={tickets.length > 1 && i !== activeIdx ? 'hidden print:block' : ''}` — for non-active tickets this is `hidden print:block`, which means they ARE shown when printing. So printing actually shows ALL tickets. The user might want to print just the current one. But actually printing all is probably desirable. However the `.seat-pass` class in print CSS sets `break-inside: avoid` which is good. This is actually correct behavior — just confirm the print CSS is applied. The `@media print` in index.css already handles `.no-print` hiding. ✅ Already handled.

**C5. Play page: After successful login from `/play`, the session is saved then navigate('/live'). But if the match is `ended`, the Live page shows "No Active Match". Should show a graceful "Match has ended" state instead.**
Line 276-285: When `!matchId || !session`, shows "No Active Match" with "Back to Login". But this is also the state when a user logs in and the match ended. Could show match result / leaderboard link here.

**C6. Admin sidebar / BottomNav: No keyboard shortcut hints**
Not a mobile issue but for desktop admin users, keyboard navigation has no hints. Minor cosmetic improvement.

---

## Summary Table

| # | Area | Issue | Effort |
|---|------|-------|--------|
| A1 | Register | Unused `Download` import cleanup | Tiny |
| A2 | Register | Show "All passes downloaded ✓" briefly before clearing progress | Small |
| A3 | Scoreboard | Clean overs display (no ".0" for complete overs) | Small |
| A4 | Ticket | "Contact reception" → tappable tel: link | Tiny |
| A5 | Live | "No Active Match" add "Go to Home" button | Tiny |
| A6 | PredictionPanel | Verify/fix empty state copy improvement | Small |
| A7 | Register | Name field add placeholder hint | Tiny |
| A8 | Index sticky bar | Show price hint "Reserve ₹999+" | Small |
| B1 | Register | Friendlier "Pay at Hotel" warning copy | Small |
| B2 | Ticket | Show balance reminder button for ALL users, not just admins | Small |
| B3 | Live | Add LogOut icon to Exit button | Tiny |
| B5 | PredictionPanel | Show running score total at top of panel | Medium |
| B6 | GameLoginCard | Add Enter key handler to PIN field | Small |
| B7 | Register | Add Enter key handlers to name → mobile flow | Small |
| C2 | Register | Save form state to sessionStorage to prevent accidental data loss | Medium |
| C3 | index.html | Add Open Graph meta tags for rich WhatsApp link previews | Small |
| C5 | Live | "Match Ended" state with link to leaderboard instead of generic "No Active Match" | Small |

---

## Recommended Batches for Implementation

**Batch 1 — Tiny wins, all low risk (implement together):**
A1 (unused import), A3 (clean overs format), A4 (tappable phone link), A5 (home button on Live), A7 (name placeholder), B3 (LogOut icon on Exit)

**Batch 2 — UX polish:**
A2 (download completion message), A6 (PredictionPanel copy), A8 (sticky bar price hint), B1 (Pay at Hotel copy), B2 (balance reminder for all users), B6 (Enter key on PIN), B7 (Enter key on name→mobile)

**Batch 3 — Structural:**
B5 (score total in PredictionPanel), C2 (sessionStorage form save), C3 (Open Graph meta tags), C5 (match ended state on Live page)
