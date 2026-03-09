
## What we're building

Two things:
1. **QR code embedded in each generated coupon PNG** — encoding the coupon code so it's scannable
2. **Coupon Redemption Scanner page** at `/admin/coupon-scan` — admins scan the QR, the backend looks up the coupon record, marks it `redeemed`, and blocks re-use

---

## Architecture

### Database: `coupons` table
A new table to persist every generated coupon with its redemption state:

```sql
CREATE TABLE public.coupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  customer_name    text NOT NULL,
  customer_mobile  text NOT NULL,
  discount_text    text NOT NULL,
  expiry_date      date,
  status      text NOT NULL DEFAULT 'active',  -- 'active' | 'redeemed' | 'expired'
  redeemed_at      timestamptz,
  redeemed_by_admin_id uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

RLS: Readable + writable by `authenticated` only.

---

### QR code in the PNG canvas

The `qrcode.react` package is already installed. However, `qrcode.react` is a React component — we need a canvas-compatible approach. The `qrcode.react` package also exports a lower-level `QRCode` that can render to a DOM canvas. We'll use the `qrcode` package's `toCanvas` method **or** render a hidden `<canvas>` QR via `qrcode.react`'s `QRCodeCanvas` component into an off-screen DOM node, then `drawImage` it onto our coupon canvas.

Simplest approach: use `qrcode.react`'s exported `QRCodeCanvas` by temporarily appending an off-screen DOM element, calling `ReactDOM.render` — but that's ugly. **Better**: use the `qrcode` npm module directly since `qrcode.react` bundles it. We can import `QRCode` from `qrcode` as a utility and call `QRCode.toCanvas(canvasEl, text)`.

Actually, checking the package.json — `qrcode.react` v4 is installed. We can use its `renderQRCodeCanvas` utility or just use the raw `qrcode` library. Since `qrcode.react` depends on `qrcode`, we can import: 
```ts
import QRCode from 'qrcode';
// QRCode.toCanvas(canvas, text, options)
```

This draws a QR code onto any canvas element. We'll:
1. Create a temp `<canvas>` element
2. `await QRCode.toCanvas(tempCanvas, code, { width: 120, margin: 1 })`
3. `ctx.drawImage(tempCanvas, x, y, 120, 120)` — placed in the lower section of the coupon (above the footer, below the dashed perforation line)

Canvas layout adjustment: The QR goes at around `y=680` in the lower "hotel" zone, sized 100×100px, centered. The hotel logo shifts left of center, and QR goes right of center — **OR** we place the QR *above* the logo/hotel zone, right after the dashed perforation line at y=660.

Concrete plan: place QR at `(W/2 - 50, 668)` sized 100×100, with the hotel logo + name staying at their current positions but nudging the QR to be centered. Actually to avoid cramping, we expand canvas height slightly OR restructure the lower zone.

**Cleaner layout**: shift logo zone down slightly. New QR block at y=668 (100×100 centered), logo at y=790, hotel name at y=876, etc. This adds ~70px total height → canvas becomes H=1120. The footer text adjusts proportionally.

**Alternatively** (simpler, no height change): embed the QR code as a small 90×90 tile in the top-right corner of the coupon body card area, positioned at `(560, 525)` — floated right inside the card while the code pill takes left side. This is the most space-efficient approach.

I'll go with: QR as a 90×90 block in the bottom section, between the dashed line and the logo. A tiny label "SCAN TO REDEEM" above it. Canvas height expands from 1050 → 1100.

---

### Saving coupons to DB on generation

In `generateAll()`, after creating each coupon PNG blob, we also `INSERT` a record into the `coupons` table via the Supabase client. This persists the coupon so the scanner can look it up.

```ts
await supabase.from('coupons').insert({
  code: coupon.code,
  customer_name: row.name,
  customer_mobile: row.mobile,
  discount_text: discountText,
  expiry_date: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : null,
  status: 'active',
});
```

---

### New page: `AdminCouponScan.tsx` at `/admin/coupon-scan`

UI:
```
┌─────────────────────────────────────────────────────┐
│  🔍  Coupon Redemption Scanner                       │
│                                                       │
│  [ Manual code input field ]  [ Redeem Button ]      │
│  [ QR Camera Scanner ]  ← reuses jsQR/BarcodeDetector│
│                                                       │
│  ── Result card ──                                   │
│  ✅ VALID   WC25-3210-ABCD                           │
│  Guest Name · +91 9876543210                         │
│  ₹500 Off · Valid until 31/12/2025                   │
│  [ Confirm Redemption ] button                       │
│                                                       │
│  ❌ ALREADY REDEEMED (shows redeemed_at timestamp)   │
│  ❌ NOT FOUND                                        │
│  ❌ EXPIRED                                          │
└─────────────────────────────────────────────────────┘
```

Flow:
1. Admin scans/types code
2. Client queries `coupons` table for the code
3. Shows result: active / redeemed / expired / not found
4. If active: shows "Confirm Redemption" button
5. On confirm: `UPDATE coupons SET status='redeemed', redeemed_at=now(), redeemed_by_admin_id=<admin_id> WHERE code=X AND status='active'`
6. Shows success toast

Camera scanner: reuse the same `jsQR`-based pattern from `AdminValidate.tsx` (already proven). The QR on the coupon encodes the plain coupon code string (e.g. `WC25-3210-ABCD`) — simple text, no JSON wrapper needed.

---

### Route + nav entries

Add to `App.tsx`:
```tsx
<Route path="coupon-scan" element={<ProtectedRoute requiredRole="operator"><AdminCouponScan /></ProtectedRoute>} />
```

Add to `AdminSidebar.tsx` and `AdminBottomNav.tsx`:
```ts
{ icon: ScanLine, label: 'Coupon Scan', to: '/admin/coupon-scan', minRole: 'operator' }
```

---

### Files to create/edit

| Action | File | Change |
|---|---|---|
| **Create** | `src/pages/admin/AdminCouponScan.tsx` | New scanner page |
| **Edit** | `src/pages/admin/AdminCoupons.tsx` | Add QR to canvas + save to DB on generate |
| **Edit** | `src/App.tsx` | Add new route |
| **Edit** | `src/components/admin/AdminSidebar.tsx` | Add nav item |
| **Edit** | `src/components/admin/AdminBottomNav.tsx` | Add nav item |
| **DB Migration** | `coupons` table | New table with RLS |

The `qrcode` package is a dependency of `qrcode.react` (already installed) — we import `QRCode from 'qrcode'` directly. No new npm packages needed.
