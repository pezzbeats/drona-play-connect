
## What We're Building

After a successful booking (step 3), automatically open WhatsApp with a pre-filled confirmation message directed to the customer's own number (`wa.me/91{mobile}?text=...`). This reuses the exact same deep-link pattern already in `Ticket.tsx`'s `buildReminderLink` function.

**Why `wa.me/91{mobile}` and not a server-side send**: WhatsApp's free API is client-side only. The existing codebase already uses `https://wa.me/91{order.purchaser_mobile}?text=...` in `Ticket.tsx` — this opens WhatsApp on the customer's phone with a pre-filled message they can send to themselves as a reminder. That's the pattern we extend here.

---

## Implementation Plan

### Single file: `src/pages/Register.tsx`

**1. Add a `buildConfirmationWALink` helper** (alongside `buildTicketShape`):

```typescript
const buildConfirmationWALink = (): string => {
  const ticketUrl = `https://drona-play-connect.lovable.app/ticket?mobile=${mobile}`;
  const matchName = activeMatch?.name ?? 'T20 Fan Night';
  const matchOpp = activeMatch?.opponent ? ` vs ${activeMatch.opponent}` : '';
  const matchVenue = activeMatch?.venue ?? '';
  const matchDate = activeMatch?.start_time
    ? new Date(activeMatch.start_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const paidLine = paymentMethod === 'pay_at_hotel'
    ? `💳 Payment: Pay ₹${priceQuote?.total ?? ''} at the venue`
    : `✅ Payment: ₹${priceQuote?.total ?? ''} Confirmed`;
  const seatNos = tickets.map(t => `Seat ${t.seat_index + 1}`).join(', ');

  const lines = [
    `🎟️ Booking Confirmed — Hotel Drona Palace`,
    ``,
    `Hi ${fullName}! Your T20 Fan Night pass${tickets.length > 1 ? 's are' : ' is'} ready.`,
    ``,
    `🏏 Match: ${matchName}${matchOpp}`,
    matchVenue ? `📍 Venue: ${matchVenue}` : null,
    matchDate  ? `🗓️ Date: ${matchDate}` : null,
    `🪑 Seats: ${seatNos}`,
    paidLine,
    ``,
    `🎫 View passes anytime: ${ticketUrl}`,
    ``,
    `— Hotel Drona Palace`,
  ].filter(Boolean).join('\n');

  return `https://wa.me/91${mobile}?text=${encodeURIComponent(lines)}`;
};
```

**2. Auto-open WhatsApp after step transitions to 3** — add inside the existing `useEffect` that runs on `step === 3`, after the download stagger completes:

```typescript
// After all downloads finish, open WhatsApp confirmation
const waLink = buildConfirmationWALink();
window.open(waLink, '_blank');
```

But since `buildConfirmationWALink` uses closure state and mobile/tickets/paymentMethod/priceQuote will all be set by the time step 3 loads, this works cleanly.

**3. Add a "Send WhatsApp Confirmation" fallback button** on step 3 — for cases where the browser blocked the auto-open (mobile Safari sometimes blocks `window.open` in async contexts). Show a small "Didn't receive the WhatsApp? Tap to resend" button below the download CTA.

```jsx
<button
  onClick={() => window.open(buildConfirmationWALink(), '_blank')}
  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm ..."
>
  Resend WhatsApp Confirmation
</button>
```

---

## Message Format (preview)

```
🎟️ Booking Confirmed — Hotel Drona Palace

Hi Ravi! Your T20 Fan Night passes are ready.

🏏 Match: T20 Night vs Challengers
📍 Venue: Hotel Drona Palace Banquet
🗓️ Date: 15 Mar 2025, 07:00 PM
🪑 Seats: Seat 1, Seat 2
✅ Payment: ₹1000 Confirmed

🎫 View passes anytime: https://drona-play-connect.lovable.app/ticket?mobile=9876543210

— Hotel Drona Palace
```

---

## Technical Notes

- `window.open` in a `useEffect` (async context) may be blocked on iOS Safari — that's why we add the fallback button
- The `useEffect` already has an 800ms delay before downloads start; we add the WhatsApp open **after** the loop (after all downloads finish or after the first one for instant feel)
- No new files, no DB changes, no edge functions

## Files to change

| File | Change |
|------|--------|
| `src/pages/Register.tsx` | Add `buildConfirmationWALink` helper; trigger `window.open` to it in step-3 `useEffect` after downloads; add fallback "Resend WhatsApp" button on step 3 UI |
