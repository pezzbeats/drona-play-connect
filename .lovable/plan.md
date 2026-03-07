
## Plan: Record ₹2000 UPI Advance for Shiva Gautam + Add "Edit Advance" Action in Admin Orders

### Confirmed order found
- **Order ID**: `7adf627b-393f-48e0-a5cc-0d3e2e4ade38`
- **Name**: Shiva Gautam | **Mobile**: 7453064444
- **Total**: ₹2997 | **Balance after advance**: ₹997
- Current state: `advance_paid = 0`, `payment_status = unpaid`

---

### What to do

#### 1. Data update (direct DB writes — no migration needed)
Two operations via the Supabase data tools:

**a) Update the order:**
```sql
UPDATE orders 
SET advance_paid = 2000, advance_payment_method = 'upi'
WHERE id = '7adf627b-393f-48e0-a5cc-0d3e2e4ade38';
```

**b) Insert payment_collections record:**
```sql
INSERT INTO payment_collections (order_id, collected_by_admin_id, method, amount, note)
VALUES (
  '7adf627b-393f-48e0-a5cc-0d3e2e4ade38',
  (SELECT user_id FROM admin_roles LIMIT 1),  -- system admin
  'upi',
  2000,
  'Advance payment ₹2000 via UPI — balance ₹997 due at entry'
);
```

#### 2. UI improvement — "Edit Advance" in AdminOrders (for future use)
Add a small inline form inside the expanded order detail section in `AdminOrders.tsx` that lets admins set/update `advance_paid` and `advance_payment_method` for any order that isn't fully paid. This appears as a collapsible **"Record Advance"** button alongside Verify/Reject.

The form:
- Amount input (number, 0 to total_amount)
- Mode select: Cash / Card / UPI
- On save: updates `orders.advance_paid`, `orders.advance_payment_method`, inserts a `payment_collections` row, refreshes list
- Only shown for orders with `payment_status` in: `unpaid`, `pending_verification`

---

### Files changed
| Change | Where |
|--------|--------|
| ₹2000 UPI advance recorded for Shiva Gautam | DB data update (orders + payment_collections) |
| "Record Advance" inline form | `src/pages/admin/AdminOrders.tsx` |

No migration needed — columns already exist. No edge function changes needed.
