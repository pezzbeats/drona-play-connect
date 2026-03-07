
## Plan: Fix Dashboard Stats + Delete Test Bookings

### Two separate things to fix:

---

### 1. Dashboard stat bugs

**Current broken logic in `AdminDashboard.tsx`:**

- `unpaidOrders` counts only: `payment_status === 'unpaid' && advance_paid === 0`  
  → This misses partially-paid orders, `pay_at_hotel` with no advance, `paid_rejected`, etc.

- `balanceDueOrders` filters: `!isPaid && advance_paid > 0`  
  → This only catches partial-advance orders — misses fully-unpaid `pay_at_hotel`, `upi_qr` unpaid, `razorpay` unpaid, `paid_rejected`, etc.  
  → The label also says "with advance paid" which is wrong

**Correct logic:**

```
// "Unpaid" stat = all orders that are NOT fully paid
unpaidOrders = orders where payment_status NOT IN ('paid_verified', 'paid_manual_verified')

// "Balance Outstanding" = total receivable from ALL non-fully-paid orders
// = SUM of (total_amount - advance_paid) for all unpaid/partial orders
balanceDueOrders = all non-paid-verified orders
balanceDueTotal = SUM(total_amount - advance_paid) across all those orders
```

The "Pending" stat card currently shows `pending_verification` which is correct and stays separate.

The "Unpaid" stat card should be renamed to **"Not Paid"** (or "Outstanding") to reflect it covers all non-fully-paid statuses.

**Balance Outstanding alert:**
- Change subtitle from "across N orders with advance paid" → "across N unpaid/partial orders"
- Amount will now correctly reflect the entire receivable

---

### 2. Delete test bookings via DB migration

The 5 test orders (Shekhar, Test User, Abhishek Balodi, Test Booking, Pramod Negi) and their related tickets need to be hard-deleted via SQL migration since the RLS policy on `orders` and `tickets` has no DELETE permission for client-side calls.

Order IDs to delete:
- `35f41f49` — Shekhar
- `5ff160be` — Test User  
- `532f1f8a` — Abhishek Balodi
- `9b350841` — Test Booking
- `bfe4c1e6` — Pramod Negi

Related data to clean:
- `tickets` (3 records exist for Shekhar, Test User, Test Booking)
- `payment_collections` (if any — query showed none)
- `admin_activity` referencing these order IDs
- `payment_proofs` (if any)
- Then `orders` themselves

Migration order: tickets → payment_proofs → admin_activity → orders (due to FK constraints)

---

### Files changed

| What | Where |
|------|--------|
| Fix `unpaidOrders` count to include all non-fully-paid | `src/pages/admin/AdminDashboard.tsx` |
| Fix `balanceDueOrders` to include all non-paid-verified orders | `src/pages/admin/AdminDashboard.tsx` |
| Fix balance card subtitle text | `src/pages/admin/AdminDashboard.tsx` |
| Rename "Unpaid" stat label | `src/pages/admin/AdminDashboard.tsx` |
| Delete 5 test order rows + related tickets/proofs | DB migration SQL |
