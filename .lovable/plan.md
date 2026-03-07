
## Fix: Replace "upi" with "upi_qr" in Manual Booking Form

### Root Cause
The `payment_method_enum` in the database has the value `"upi_qr"` (not `"upi"`). The manual booking form (`AdminManualBooking.tsx`) uses `"upi"` as both:
1. A `SelectItem` value for **Primary Payment Method** dropdown
2. A `SelectItem` value for **Advance Mode** dropdown

When submitted, both `payment_method` and `advance_payment_method` are passed to the `create-order` edge function, which inserts them directly into the `orders` table column typed as `payment_method_enum`. Postgres rejects `"upi"` since it's not a valid enum value.

The `create-order` edge function also has a `methodMap` that maps `"upi" → "upi"` for `payment_collections`, which would also fail.

### Fix — `src/pages/admin/AdminManualBooking.tsx` only

1. Change `<SelectItem value="upi">UPI</SelectItem>` → `<SelectItem value="upi_qr">UPI</SelectItem>` in the **Primary Payment Method** dropdown
2. Change `<SelectItem value="upi">UPI</SelectItem>` → `<SelectItem value="upi_qr">UPI</SelectItem>` in the **Advance Mode** dropdown
3. Update the default value in state: `advance_payment_method: 'cash'` stays the same (cash is fine), but verify the `payment_method` default is also safe

That's the complete fix — two `SelectItem` value changes. The display label "UPI" stays the same, only the underlying value passed to the DB changes from `"upi"` to `"upi_qr"`.

No edge function changes needed — `create-order` already passes the value through directly and the `methodMap` for `payment_collections` can also be corrected (it maps `upi → upi` but the collection method column is also `payment_method_enum`).

### Files
| File | Change |
|------|--------|
| `src/pages/admin/AdminManualBooking.tsx` | Two `SelectItem` value fixes: `"upi"` → `"upi_qr"` |
| `supabase/functions/create-order/index.ts` | Fix `methodMap` entry `upi: "upi"` → `upi_qr: "upi_qr"` |
