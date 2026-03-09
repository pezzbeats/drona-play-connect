
## Plan: Add Name/Mobile + Expiry Date to Coupon PNG

### What changes

**`src/pages/admin/AdminCoupons.tsx` only** — no other files.

---

### 1. New state: `expiryDate`

```ts
const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
```

- Load from `localStorage` alongside existing discount settings (stored as ISO string, re-hydrated to `Date`)
- Save to `localStorage` when admin clicks "Save Settings"
- Pass formatted string (`dd/MM/yyyy`) into `buildCouponCanvas`

---

### 2. UI — date picker in Coupon Settings card

Add a new row below the discount type toggle:

```
Coupon Expiry Date  [ 📅 31/12/2025 ]   ← Shadcn Popover + Calendar
```

Imports needed: `Calendar`, `Popover/PopoverContent/PopoverTrigger` from shadcn, `format` from `date-fns`, `CalendarIcon` from lucide.

---

### 3. Canvas changes (`buildCouponCanvas`)

New signature: `buildCouponCanvas(row, discountText, code, logoImg, expiryStr)`

**Two additions to the canvas layout:**

**A. Customer mobile line** — right below the name (currently at y=338):
```
y=360  "+91 XXXXXXXXXX"   font: 400 16px Cinzel, color: rgba(245,185,66,0.6)
```
Coupon body card shifts from y=370 → y=388 (18px gap to breathe).

**B. Inside coupon body card** — shift all elements down +18px to fit expiry line:
- Card rect: y=388, height=272 (ends at y=660 — same dashed line position preserved)
- "YOUR EXCLUSIVE DISCOUNT": y=425 (was 405, +20)
- Discount amount: y=502 (was 490, +12)
- Code pill: y=522–572 (was 510–560, +12)
- "Valid on your next visit": y=595 (was 590, +5)
- **NEW** `"Valid until DD/MM/YYYY"` (or `"No expiry set"` if blank): y=620, font 13px italic, color rgba(245,185,66,0.55)
- Remove "Present this coupon at hotel reception" from card — it already appears in the footer strip at y=875

Dashed perforation stays at y=660. Everything below (logo, hotel name, footer) unchanged.

---

### 4. WhatsApp pre-filled message

Add expiry line to the WA text:
```
📅 Valid until: DD/MM/YYYY
```

---

### Files to edit

| File | Change |
|---|---|
| `src/pages/admin/AdminCoupons.tsx` | Add expiry state + date picker UI + canvas mobile/expiry lines |

No DB, no edge functions, no other files.
