
## Discount System for Admin Manual Booking

### What needs to happen

The `orders` table has no discount columns yet. We need to add `discount_type`, `discount_value`, and `discount_amount` columns to persist the discount, then wire up:
1. **DB migration** — add 3 columns to `orders`
2. **`create-order` edge function** — accept discount params, apply to `total_amount` before saving
3. **`AdminManualBooking.tsx`** — UI for entering discount (toggle flat/percent, input, live preview in the price breakdown)

---

### Database migration
Add to `public.orders`:
```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_type  text    DEFAULT NULL,   -- 'flat' | 'percent'
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,      -- raw input (e.g. 200 or 15)
  ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0;      -- resolved rupee amount
```

No enum needed — `text` is fine, kept nullable so existing rows are unaffected.

---

### Edge function (`create-order/index.ts`)
Accept new body fields: `discount_type`, `discount_value`.

```
discount_amount = 
  if discount_type === 'flat'    → Math.min(discount_value, original_total)
  if discount_type === 'percent' → Math.floor(original_total * discount_value / 100)
  else 0

final_total = original_total - discount_amount
```

Persist `discount_type`, `discount_value`, `discount_amount` in the order row. The `pricing_snapshot` passed from UI will contain the pre-discount subtotal; the function computes and stores the final `total_amount` as `final_total`.

Validation guards: percent must be 0–100, flat must not exceed total, discount must be non-negative.

Also log discount in `admin_activity` meta.

---

### UI changes (`AdminManualBooking.tsx`)

Add discount state:
```typescript
const [discount, setDiscount] = useState({ type: 'flat', value: '' });
```

**Placement**: between the "Price Quote" card and the "Advance Payment" section. Only shown once a quote is fetched.

**Discount UI block:**
- Toggle buttons: `Flat (₹)` / `Percent (%)`
- Number input
- Real-time live display: "Subtotal ₹2997 − ₹200 discount = **₹2797**"
- If percent: shows resolved amount in muted text ("= ₹449")

**Price breakdown card** updates to show:
```
Seat #1 (new_customer)    ₹999
Seat #2 (loyal_base)      ₹949
─────────────────────────────
Subtotal                 ₹1948
Discount (10%)          −₹194
─────────────────────────────
Total                    ₹1754   ← green gradient
```

**Effective total** used for:
- Advance paid max validation (`advancePaid <= effectiveTotal`)
- Balance due calculation
- "Create Booking" button label (`₹X at entry`)

**Sending to backend:**
```typescript
body: {
  ...existing fields,
  discount_type: discount.value ? discount.type : null,
  discount_value: parseFloat(discount.value) || 0,
}
```
The edge function returns `{ order_id, tickets, advance_paid, balance_due }` — the discount has already been applied server-side in the stored `total_amount`.

---

### File changes

| File | Change |
|------|--------|
| New migration SQL | Add `discount_type`, `discount_value`, `discount_amount` to `orders` |
| `supabase/functions/create-order/index.ts` | Accept discount params, compute `discount_amount`, store adjusted `total_amount` |
| `src/pages/admin/AdminManualBooking.tsx` | Discount type toggle + value input, live breakdown, recalculated effective total wired to advance/balance logic |

No changes to `pricing-quote` edge function — it returns the raw per-seat prices and subtotal; discount is a manual admin override applied on top.

No changes to `AdminPayments.tsx` needed — the stored `total_amount` in the DB will already reflect the discounted price.
