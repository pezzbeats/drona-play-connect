
## Plan: "Send Balance Reminder" WhatsApp Button on Ticket Page

### What to add
A "Send Reminder" button that opens WhatsApp with a pre-filled message to the customer's phone number showing their outstanding balance. No API — pure `wa.me` deep link.

The button only appears when:
- `payment_status` is NOT `paid_verified` / `paid_manual_verified`
- `balanceDue > 0`

### Where it goes
In the `PassCard` component, inside the action buttons grid — as a **full-width third button** below the existing Save Pass / Share row. Styled in green (WhatsApp color) to stand out from the amber-toned card.

Also added in the top bar (the "Print All / WhatsApp" row in the main page) — a matching button there for quick access outside the card.

### WhatsApp link format
```
https://wa.me/91{mobile}?text=...
```
This opens WhatsApp directly to the contact's chat with a pre-filled message — no API, no key needed.

### Pre-filled message
```
Hi {name}! 🙏 Your T20 Fan Night Pass (Seat {N}) is booked with Hotel Drona Palace.

💰 Balance Due: ₹{balanceDue}
{if advance: ✅ Advance Paid: ₹{advance}}

Please pay the remaining amount at the hotel on arrival.

View your pass: https://drona-play-connect.lovable.app/ticket?mobile={mobile}

— Hotel Drona Palace
```

### Changes required
Only **`src/pages/Ticket.tsx`**:

1. Build `buildReminderLink(order, ticket)` function that constructs the `wa.me` URL
2. Add `onRemind` prop to `PassCard` (optional, only passed when `hasBalance === true`)
3. Render a full-width WhatsApp-green "Send Balance Reminder" button below the existing 2-column action row — only when `hasBalance` is true
4. Wire `onRemind` in the ticket card list render
5. Also add a "Remind" button to the top row (next to Print All / WhatsApp) that applies to the current active ticket if it has a balance
