
## Problem
`Register.tsx` step 3 (confirmation screen) shows an old simple card with a raw QR code, and the auto-download saves just a bare QR PNG. The full professional pass design (`buildPassCanvas` + `PassCard`) only exists in `Ticket.tsx`.

## Root Cause
- `tickets` state in Register holds plain rows: `{ id, qr_text, seat_index, status }` — no nested `order`/`match` data
- `buildPassCanvas` in `Ticket.tsx` requires a `TicketData` shape with `ticket.order.purchaser_full_name`, `ticket.order.match.name`, etc.
- The step 3 UI (lines 1096–1200) renders a completely different old card design, not the `PassCard` component

## Fix Plan

### 1. Extract pass generation into `Register.tsx`

Since all needed data is already in React state (`fullName`, `mobile`, `activeMatch`, `seatingType`, `seatsCount`, `priceQuote`, `paymentMethod`, `orderId`), we construct a synthetic `TicketData`-compatible object per ticket:

```typescript
const buildTicketShape = (ticket: any): TicketData => ({
  id: ticket.id,
  seat_index: ticket.seat_index,
  qr_text: ticket.qr_text,
  status: ticket.status ?? 'active',
  issued_at: ticket.issued_at ?? new Date().toISOString(),
  order: {
    purchaser_full_name: fullName,
    purchaser_mobile: mobile,
    payment_status: paymentMethod === 'pay_at_hotel' ? 'unpaid' : 'paid_manual_verified',
    seats_count: seatsCount,
    total_amount: priceQuote?.total ?? 0,
    seating_type: seatingType,
    advance_paid: 0,
    match: {
      name: activeMatch!.name,
      venue: activeMatch!.venue,
      start_time: activeMatch!.start_time,
      opponent: activeMatch!.opponent ?? null,
    },
  },
});
```

### 2. Port `buildPassCanvas` + helpers into Register.tsx

Copy the following from `Ticket.tsx` into `Register.tsx`:
- `loadImage` helper
- `roundRect` helper  
- `buildPassCanvas` function
- `downloadPassAsPng` function

These are pure canvas drawing functions with no external dependencies (they only use `hotelLogo` which is already imported in Register).

### 3. Replace old step 3 card UI with `PassCard`-equivalent

Instead of importing `PassCard` (which references `Ticket.tsx`-specific types), we render the same visual structure inline. Simpler: just render `PassCard` directly — since it's defined in `Ticket.tsx` as a local function, we move it to a shared location OR just port the visual pattern inline in Register.

**Cleanest approach**: Extract `PassCard` + `buildPassCanvas` + helpers into a new shared component file `src/components/ui/TicketPassCard.tsx`. Both `Register.tsx` and `Ticket.tsx` import from there.

But that's a bigger refactor. **Fastest correct fix**: 

- Keep `PassCard` in `Ticket.tsx` as-is
- In `Register.tsx`, replace the old step 3 card rendering with the same dark-card HTML structure (copy the JSX pattern from PassCard but using Register's local state)
- Add `buildPassCanvas` + helpers to Register
- Fix auto-download to call `buildPassCanvas` with the synthetic ticket shape

### 4. Fix the auto-download `useEffect`

Current code (lines 334–352) downloads from `qr-auto-${ticket.id}` canvas — a raw QR PNG. Replace with:

```typescript
useEffect(() => {
  if (step !== 3 || tickets.length === 0 || !activeMatch) return;
  const timer = setTimeout(async () => {
    for (const ticket of tickets) {
      const shaped = buildTicketShape(ticket);
      try {
        const canvas = await buildPassCanvas(shaped);
        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pass-seat-${ticket.seat_index + 1}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        });
      } catch { /* silent */ }
    }
  }, 800);
  return () => clearTimeout(timer);
}, [step, tickets]);
```

Note: `buildPassCanvas` needs the hidden `QRCodeCanvas` elements still present. The hidden `qr-canvas-${ticket.id}` canvases (used by `buildPassCanvas` to draw the QR into the pass) must remain in the DOM at step 3. The existing `qr-auto-*` canvases can be replaced with `qr-canvas-*` (matching the ID scheme that `buildPassCanvas` expects).

### 5. Replace old step 3 UI card with proper PassCard design

Replace lines 1128–1167 in Register.tsx (the old simple card) with the same dark-card JSX from `PassCard` in Ticket.tsx, adapted to use local Register state. The `onDownload` handler calls `buildPassCanvas(buildTicketShape(ticket))`.

Remove the hidden `qr-auto-*` canvas elements and replace with `qr-canvas-*` (ID scheme expected by `buildPassCanvas`).

### 6. Fix WhatsApp share in Register

Update `handleWhatsAppShare` to also use `buildPassCanvas` instead of the raw `qr-auto-*` canvas.

## Files to change

| File | Change |
|------|--------|
| `src/pages/Register.tsx` | Port `buildPassCanvas`+helpers, add `buildTicketShape`, replace step 3 old card with PassCard-style UI, fix auto-download + WhatsApp share, rename hidden canvas IDs from `qr-auto-*` to `qr-canvas-*` |

No new files. No DB changes. No edge function changes.

## Key constraint
`buildPassCanvas` reads `document.getElementById(`qr-canvas-${ticket.id}`)` — so the hidden `QRCodeCanvas` elements at step 3 must use id `qr-canvas-${ticket.id}` (not `qr-auto-${ticket.id}` as currently). This is the only wiring change needed for the canvas render to work.
