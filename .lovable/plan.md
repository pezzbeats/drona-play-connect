
## Full Customer Experience Audit

After reading all customer-facing pages in detail (`Register.tsx`, `Ticket.tsx`, `Index.tsx`, `Play.tsx`, `AdminValidate.tsx`, `VoiceAgent.tsx`), here are all the issues and enhancements identified:

---

### Issues Found

**1. Register.tsx — `buildTicketShape` maps `payment_status` incorrectly for Razorpay payments**
- After Razorpay payment success, `verifyData.tickets` are returned from the backend. These raw ticket objects don't have `advance_paid` info, yet `buildTicketShape` hardcodes `advance_paid: 0`. 
- More critically, for Razorpay it sets `payment_status: paymentMethod === 'pay_at_hotel' ? 'unpaid' : 'paid_manual_verified'` — but Razorpay-verified payments have status `'paid_verified'`, not `'paid_manual_verified'`. So the canvas pass banner shows as "UNPAID" or wrong colour for Razorpay customers.
- **Fix**: For Razorpay, map to `'paid_verified'`. Better yet: after `verifyData` comes back, re-fetch the ticket shape from the DB (or accept `payment_status` from the verify response).

**2. Register.tsx — WhatsApp share only shares first ticket for multi-seat bookings**
- `handleWhatsAppShare` iterates all tickets to build files, but the WhatsApp deep-link text says "X seats" without seat-specific info. Minor, but the share text for multi-seat bookings isn't personalized per-seat.
- Acceptable as-is, but mention in plan.

**3. Register.tsx — Auto-download fires once for all tickets but `buildTicketShape` uses `paymentMethod` state that may be stale when Razorpay redirects back**
- By the time step 3 shows, the `paymentMethod` state should still be correct because it's set in step 2 and not cleared. This is fine.

**4. Register.tsx — `buildTicketShape` hardcodes `'paid_manual_verified'` for non-pay_at_hotel**
- Should be `isPaid = paymentMethod === 'razorpay' ? 'paid_verified' : 'paid_manual_verified'` or better, use the actual status from verifyData.
- This makes the pass banner colour wrong (amber/gold instead of green) for Razorpay customers.

**5. Register.tsx — Missing "View Your Passes" CTA after step 3**
- After booking, the customer's only recovery path is `/ticket` link buried at bottom of the support section. No prominent "View Passes Later" button at the top of the confirmation screen.
- Add a prominent link to `/ticket?mobile=X` so customers can always retrieve their passes.

**6. Register.tsx — Download triggers even for multiple tickets simultaneously (browser may block multiple downloads)**
- `buildPassCanvas` is called in a loop without any gap. Most browsers allow at most 1 programmatic download without user gesture — subsequent ones get blocked silently.
- **Fix**: Add a small `await new Promise(r => setTimeout(r, 300))` between each ticket download in the loop, or download only the first one automatically and let users tap "Save Pass" for the rest.

**7. Register.tsx — `seatsCount` resets to 1 on step navigation but `priceQuote` persists**
- If user goes back from step 2 → 1 and the quote is still shown, there's no visual "quote is fresh" vs "quote is recalculating" indicator until `quoteLoading` kicks in. Minor UX but can show stale price for a split second.

**8. Ticket.tsx — `buildReminderLink` hardcodes `drona-play-connect.lovable.app`**
- The published URL is `https://drona-play-connect.lovable.app` so this is technically fine. No change needed.

**9. Ticket.tsx — "No Tickets Found" empty state has no "Book Now" CTA**
- When a customer types the wrong number or hasn't booked yet, they see a plain "No passes found" message with only a "Try Again" button. Should also show a "Book Seats" link.

**10. Ticket.tsx — Mobile number input on `/ticket` page doesn't strip country code**
- `validateMobile` does strip `+91` prefix (line 47), but the input doesn't have a `+91` prefix indicator that Register does, making the UI inconsistent. Minor.

**11. AdminValidate.tsx — After successful check-in, `lookupTicket` is called again (line 497)**
- This re-fetches the ticket (now `status: 'used'`) and resets `scanFeedback` to `'error'` (because `isCheckedIn` makes `outcome = 'reuse_blocked'`), overwriting the success state with a red flash.
- The PIN display relies on `gamePin` state which is set before `lookupTicket`, so PIN survives. But the red feedback is confusing.
- **Fix**: After successful check-in, set `scanFeedback('success')` AFTER the re-fetch and don't treat `'used'` as error if it was just checked in (pass a `justCheckedIn` flag, or simply don't re-trigger `setScanFeedback`).

**12. AdminValidate.tsx — `lookupTicket` wipes `gamePin` to `null` on every call (line 230)**
- This means if `lookupTicket` is called after check-in (to refresh data), the PIN disappears from the UI.
- **Fix**: Don't reset `gamePin` inside `lookupTicket`, or only reset it at the top when the `qrInput` changes to a different value.

**13. VoiceAgent.tsx — "Need Help? 🎙️" label appears on admin pages too**
- `VoiceAgentGuard` in App.tsx only hides it for `/register`, `/ticket`, `/play`, `/live` — but NOT for `/admin/*`. Gate staff will see the floating microphone button on the validate page.
- **Fix**: Add a prefix check for `/admin` paths to the hide list.

**14. Index.tsx — No add-to-home-screen or "save this page" prompt**
- Customers who book passes may need to come back to `/ticket` on match day. No nudge to save the link.
- Minor improvement: show a small "Save this link" note near the bottom CTAs.

**15. Register.tsx — `email` field is optional but not labelled as such clearly (says "Email (optional)")**
- Actually it IS labelled "(optional)" — no issue.

**16. Register.tsx — Phone number input has no `+91` country code prefix display in Step 0**
- Mobile input doesn't show "+91" prefix (unlike the `/ticket` page which has the chip). Inconsistency.
- **Fix**: Add a `+91` chip prefix to the Register mobile input for visual consistency and trust.

**17. Register.tsx — `email` field uses `block text-center` label alignment**
- "Full Name *" and "Email (optional)" labels are center-aligned, but "Mobile Number *" is left-aligned (with the counter on the right). Inconsistency.
- **Fix**: Align all labels consistently (left-align is better UX for forms).

**18. Register.tsx — `priceQuote` is not cleared when user changes seat count/seating type while quote is loading**
- If `seatsCount` changes from 2 → 3 while the quote for 2 is loading, the old quote for 2 is shown briefly. `useEffect` for `fetchQuote` does fire again, but there's a window where the old data shows.
- **Fix**: `setPriceQuote(null)` when `seatsCount` or `seatingType` change.

**19. Register.tsx — The "View Passes" link at `/ticket` in the support footer uses static domain**
- Line 1646: `<Link to="/ticket"` — this is a React Router `Link`, so it's fine.

---

### Summary of changes to make

| File | Fix |
|------|-----|
| `Register.tsx` | Fix `buildTicketShape` payment_status for Razorpay (`paid_verified` not `paid_manual_verified`); stagger auto-downloads; clear `priceQuote` on seat/type change; add `+91` prefix to mobile input; left-align form labels; add prominent "View Your Passes" link on step 3 |
| `Ticket.tsx` | Add "Book Seats" CTA to empty state; add `+91` chip to mobile input |
| `AdminValidate.tsx` | Don't wipe `gamePin` on `lookupTicket`; don't flash red after a fresh check-in; add `/admin` to the VoiceAgent hide path |
| `App.tsx` | Add `/admin` prefix to `HIDE_VOICE_AGENT_PATHS` check (use `startsWith` instead of `includes`) |

---

### Plan

**File: `src/App.tsx`**
- Change `HIDE_VOICE_AGENT_PATHS.includes(location.pathname)` → also hide when `location.pathname.startsWith('/admin')`. This removes the microphone from all admin screens.

**File: `src/pages/Register.tsx`**
1. Fix `buildTicketShape`: map `payment_status` correctly — `'pay_at_hotel'` → `'unpaid'`, `'razorpay'` → `'paid_verified'`, `'upi_qr'` → `'paid_manual_verified'`
2. Stagger auto-downloads: add 350ms delay between each ticket download in the `useEffect` loop (prevents browser blocking the second+ downloads)
3. Add `+91` prefix chip to the mobile input in Step 0
4. Left-align form labels consistently (remove `text-center` from "Full Name *" and "Email (optional)" labels)
5. Clear `priceQuote` immediately when `seatsCount` or `seatingType` changes (add to the setter calls or a `useEffect`)
6. Add a prominent "View / Retrieve Your Passes →" button on step 3 below the support footer that links to `/ticket?mobile={mobile}` — so customers can always get back to their passes on their phone

**File: `src/pages/Ticket.tsx`**
1. Empty state: add a "Book Seats →" `Link` to `/register` alongside the "Try Again" button
2. Mobile input: add the `+91` chip prefix (same as Register.tsx does it) for consistency

**File: `src/pages/admin/AdminValidate.tsx`**
1. Fix `gamePin` reset: change `lookupTicket` to NOT reset `gamePin` (remove `setGamePin(null)` from line 230), or only reset it when the qr text being looked up is different from the current `qrInput`
2. Fix post-check-in red flash: after `handleCheckIn` succeeds, call `setScanFeedback('success')` after the `lookupTicket` re-fetch completes so it shows green, not red (the reuse_blocked path)

No DB migrations. No edge function changes. No new files.

---

### Technical notes on the `gamePin` / red-flash fix

Currently in `lookupTicket`:
```
setGamePin(null)  ← cleared every call
```
and in `handleCheckIn`:
```
setGamePin(data.pin)  ← set
await lookupTicket(qrInput)  ← immediately clears it again, sets feedback to 'error'
```

Fix: Remove `setGamePin(null)` from `lookupTicket`. Instead, only reset `gamePin` when the user clears the input or scans a new QR. After check-in re-fetch, explicitly call `setScanFeedback('success')` at the end of `handleCheckIn` after `lookupTicket` resolves:

```typescript
const handleCheckIn = async () => {
  ...
  await lookupTicket(qrInput);
  setScanFeedback('success'); // override the 'error' from reuse_blocked
  setCheckingIn(false);
};
```

And remove `setGamePin(null)` from `lookupTicket`, adding it only to the "scan new QR" path (i.e., when `trimmed !== qrInput`... or just when the user clears the input).
