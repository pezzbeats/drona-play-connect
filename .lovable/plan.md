
## Plan: "Save Pass" — Download Full Ticket Card as PNG

### The problem
Currently `downloadQr` grabs a hidden `<QRCodeCanvas>` element and downloads just the raw QR code pixels. The user wants the entire styled pass card (status banner, name, match info, seat number, QR, footer with logo) rendered as a beautiful PNG — exactly like what they see on screen.

### Approach: Canvas-rendered pass (no html2canvas needed)

`html2canvas` is not installed and has well-known issues with CSS gradients, `WebkitTextFillColor`, and cross-origin images. Instead, the pass will be **drawn programmatically on a `<canvas>` element** — this is reliable, fast, and produces a pixel-perfect 2× retina result every time.

The `downloadPassAsPng` function will:
1. Create an offscreen `canvas` (e.g. 750×1080 px at 2× scale)
2. Draw every section of the card in exact order:
   - Status banner (gradient fill + text: "☑ PAID — Entry Confirmed" or the unpaid/advance variant)
   - Main body background
   - Purchaser name (large bold), match name, datetime, venue, seating type
   - Seat badge on the right ("SEAT" label + large number + "of N")
   - Dashed divider line
   - QR code (pulled from the existing hidden `QRCodeCanvas`, rendered as an image into the pass canvas with white-padded rounded rect)
   - Mobile number + truncated QR text below
   - Balance Due pill if applicable
   - Footer: logo image + hotel name + legal sub-line + issue date
3. Trigger a `.png` download

The existing hidden `QRCodeCanvas` (`id="qr-canvas-{id}"`) is already 600×600 — it will be read via `canvas.drawImage()` so no QR regeneration is needed.

### Hotel logo
The logo is imported as an ES6 module (`hotelLogo` string). An `Image` element will be pre-loaded before drawing to guarantee it's available synchronously when `ctx.drawImage()` is called.

### Files changed

| File | Change |
|------|--------|
| `src/pages/Ticket.tsx` | Replace `downloadQr` with `downloadPassAsPng` that draws the full pass on canvas. No new dependency needed. Update the "Save QR" button label to "Save Pass". |

### Key function outline

```typescript
const downloadPassAsPng = async (ticket: TicketData) => {
  const W = 750, H = 1100, DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR; canvas.height = H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  // 1. Card background
  // 2. Status banner (green/amber gradient + text)
  // 3. Name, match, datetime, venue, seating
  // 4. Seat badge (right side)
  // 5. Dashed divider
  // 6. White QR box + drawImage from hidden QRCodeCanvas
  // 7. Mobile + qr_text snippet
  // 8. Balance Due pill (if applicable)
  // 9. Footer divider + logo circle + hotel name + date

  canvas.toBlob(blob => { /* trigger download */ });
};
```

The "Share" button will continue using the same canvas image for Web Share API / WhatsApp fallback — it will also be updated to use the full pass image.

### No new packages required — pure Canvas 2D API only.
