
## Understanding the request vs. what's technically possible

The user wants: "after successful payment, automatically download the ticket PNG to the device and open WhatsApp automatically to share it."

**Critical browser constraint**: The Web Share API (`navigator.share()`) with files requires a **user gesture** (a tap/click). It cannot be triggered automatically after an async operation like a payment callback without a user gesture attached to it. Razorpay's `handler` callback fires asynchronously — the original user tap gesture is gone. Browsers will silently reject any `navigator.share()` call not directly attached to a user gesture. There is no backend edge function that can invoke the device's WhatsApp — that's a client-side action only.

**What IS fully achievable automatically (no gesture needed)**:
1. Auto-download the QR PNG immediately when step 3 loads (using `URL.createObjectURL` + `a.click()`)
2. Show a prominent "Share on WhatsApp" button that triggers `navigator.share` with the PNG file (mobile) or `wa.me` deep-link (desktop) on one tap — pre-filling the message text

**What requires a tap** (browser hard limit):
- `navigator.share()` with file attachment — requires a direct user gesture

## Plan

**Two places to change: `src/pages/Register.tsx` and `src/pages/Ticket.tsx`**

### 1. Auto-download QR PNG on step 3 load (Register.tsx)

When `step` becomes `3`, use a `useEffect` to render a hidden `QRCodeCanvas` per ticket and auto-trigger `canvas.toBlob → a.click()` after a 300ms delay. This fires immediately when the payment confirmation screen appears.

- Add `QRCodeCanvas` from `qrcode.react` (already imported in Ticket.tsx, need to add to Register.tsx)
- Add hidden `QRCodeCanvas` elements per ticket in the step 3 JSX with `id="qr-auto-{ticket.id}"`
- `useEffect` watching `[step, tickets]`:
  ```ts
  if (step !== 3) return;
  // 400ms delay to let canvas render
  setTimeout(() => {
    tickets.forEach(ticket => {
      const canvas = document.getElementById(`qr-auto-${ticket.id}`) as HTMLCanvasElement;
      if (!canvas) return;
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-seat-${ticket.seat_index + 1}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    });
  }, 400);
  ```

### 2. Prominent WhatsApp share button on step 3 (Register.tsx)

Add a green WhatsApp CTA button that does:
- Mobile: `navigator.share({ files: [pngBlob], text: ..., title: ... })` — attaches the PNG and prefills message
- Desktop fallback: `window.open('https://wa.me/?text=...', '_blank')`

```text
Step 3 layout after:
┌──────────────────────────┐
│  🎟️ Payment Confirmed!   │
│  Ticket cards (QR shown) │
│                          │
│  [💚 Share on WhatsApp]  │  ← new, prominent green button
│  [🖨️ Print Tickets]      │
│  Need Help footer        │
└──────────────────────────┘
```

The WhatsApp button builds the PNG blob from the canvas, then calls `navigator.share()` with files (mobile) or opens `wa.me/?text=` (desktop). Message pre-filled: `"🎫 My T20 Fan Night Pass — [Match Name] — Seat 1. View at: https://drona-play-connect.lovable.app/ticket?mobile=XXXXXX"`

### 3. Same WhatsApp button improvement on Ticket.tsx

Update `whatsappShare` to also try sharing a PNG file alongside the link on mobile — consistent experience.

### Files changed
| File | Change |
|---|---|
| `src/pages/Register.tsx` | Import `QRCodeCanvas`, add auto-download `useEffect` on step 3, add WhatsApp share button |
| `src/pages/Ticket.tsx` | Upgrade `whatsappShare` to include PNG file in `navigator.share` call on mobile |

No backend edge function needed — this is entirely a client-side feature. The download is automatic; the WhatsApp share requires one tap on mobile (browser hard limit).
