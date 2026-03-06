
## Root Cause Analysis

The screenshot shows `/ticket` with "No ticket reference provided" — this happens because:
1. The **"View Your Passes"** link on the homepage goes to `/ticket` with **no URL params** (no `?order_id=` or `?mobile=`)
2. The current page immediately shows the error state when both params are absent

Additionally there are two other bugs to fix:
- The mobile lookup `query.eq('order.purchaser_mobile', mobile)` **won't work** — Supabase client can't filter on a joined table column this way; need to query orders first to get order IDs, then fetch tickets
- WhatsApp share and QR PNG download are missing

---

## Plan

### 1. Phone number entry gate (the main fix)

When `/ticket` loads with **no params**, instead of showing "No Tickets Found", show a **mobile input form**:

```text
┌─────────────────────────────────────────┐
│  🎫  View Your Passes                   │
│  Enter your registered mobile number   │
│                                         │
│  [+91  ___________  ]                  │
│                                         │
│  [ Find My Tickets → ]                  │
└─────────────────────────────────────────┘
```

- Validate: 10 digits, India mobile (starts 6–9)
- On submit: normalize to 10-digit string, fetch tickets by mobile
- Show inline error if number invalid or no tickets found

### 2. Fix the mobile-based ticket lookup query

Current broken approach:
```ts
query.eq('order.purchaser_mobile', mobile)  // ❌ can't filter on joined table
```

Fix — two-step query:
1. Fetch `order_id`s from `orders` where `purchaser_mobile = mobile`
2. Fetch tickets where `order_id IN (...)` using `.in('order_id', orderIds)`

### 3. Download QR as PNG

Add a **"Save QR"** button per ticket card. Use an off-screen `<canvas>` to render the QR via `qrcode.react`'s `QRCodeCanvas` component (swap SVG → Canvas for the download target, hidden from view), then call `canvas.toBlob()` → create object URL → trigger download as `ticket-seat-N.png`.

### 4. WhatsApp share

Add a **"Share on WhatsApp"** button that:
- On mobile: uses `navigator.share({ title, text, url })` (native Web Share API — opens native share sheet, user can pick WhatsApp)
- Fallback: opens `https://wa.me/?text=` deep link with ticket URL and a friendly message
- Message template: `"🎫 My T20 Fan Night Pass — Seat N — View at: [URL]"`

---

## Files to change

| File | Change |
|---|---|
| `src/pages/Ticket.tsx` | Mobile entry form, fixed query, PNG download, WhatsApp share |

### State machine inside `TicketPage`

```text
phase: 'input'   → show mobile entry form (when no params)
phase: 'loading' → spinner
phase: 'found'   → show tickets
phase: 'empty'   → show "no tickets" with retry option
```

When `order_id` param is present, skip `input` phase and go straight to `loading`.

### QR download implementation

```tsx
// Hidden canvas sibling per ticket, referenced via useRef array
<QRCodeCanvas id={`qr-canvas-${ticket.id}`} value={ticket.qr_text} size={300} style={{display:'none'}} />

// Download handler
const canvas = document.getElementById(`qr-canvas-${ticket.id}`) as HTMLCanvasElement;
canvas.toBlob(blob => {
  const url = URL.createObjectURL(blob!);
  const a = document.createElement('a'); a.href = url;
  a.download = `ticket-seat-${ticket.seat_index + 1}.png`;
  a.click();
});
```

### WhatsApp share

```tsx
const whatsappShare = (ticket: TicketData) => {
  const text = `🎫 My T20 Fan Night Pass — ${match.name} — Seat ${ticket.seat_index + 1}\nView at: ${window.location.href}`;
  if (navigator.share) {
    navigator.share({ title: 'My T20 Fan Night Ticket', text, url: window.location.href });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
};
```
