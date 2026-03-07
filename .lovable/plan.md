
## Full Plan: Advance Payment + Professional QR Pass Design

### What the user wants
1. **Manual booking**: Optional "advance paid" amount + payment mode (cash/card/UPI). If ₹3,000 paid out of ₹3,996 total → balance due = ₹996.
2. **Balance shown everywhere**:
   - Ticket/pass page (public) — "Balance Due: ₹996"
   - Admin Orders page — balance chip visible
   - Gate scanner (AdminValidate) — prominent "BALANCE DUE" alert before allowing check-in
3. **Gate scanner collect payment** — the existing "Collect Payment" section should pre-fill with the balance due amount (not full amount)
4. **Professional QR pass** — redesign the ticket card on Ticket.tsx to exactly match the uploaded screenshot: dark card, green top banner "PAID — Entry Confirmed", name/match/date/venue on left, SEAT number top-right, large centered white-bg QR, mobile + truncated QR text below, Save QR + Share buttons, hotel logo footer

---

### Database changes

**Migration: add `advance_paid` and `advance_payment_method` columns to `orders`**
```sql
ALTER TABLE public.orders 
  ADD COLUMN advance_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN advance_payment_method text;
```
No new table needed — this is a simple extension to orders.

---

### Files to change

#### 1. DB Migration (new file)
Add `advance_paid` (integer, default 0) and `advance_payment_method` (text, nullable) to `orders`.

#### 2. `src/pages/admin/AdminManualBooking.tsx`
Add to the booking form (after payment method select):
- **Advance Paid** input (number, optional, ≥0, ≤total)
- **Advance Payment Mode** select (Cash / Card / UPI) — shown only if advance_paid > 0
- Show computed "Balance Due: ₹X" badge in the price quote block
- Pass `advance_paid` and `advance_payment_method` in the `create-order` edge function body

#### 3. `supabase/functions/create-order/index.ts`
- Accept `advance_paid` and `advance_payment_method` in body
- Store them on the order insert
- If `advance_paid >= total_amount` → set `payment_status: 'paid_manual_verified'` (fully paid upfront)
- If `advance_paid > 0` → set `payment_status: 'partial_advance'` — but we need to check if that enum value exists

Looking at the DB: `payment_status` is USER-DEFINED (enum). Current values: `unpaid`, `pending_verification`, `paid_verified`, `paid_manual_verified`, `paid_rejected`. We need to add `partial_advance` to the enum OR just use `unpaid` but let the advance_paid field speak for itself. 

**Decision**: Keep `payment_status = 'unpaid'` for partial advance — the `advance_paid` column is the source of truth for balance calculation. This avoids adding a new enum value. The balance due = `total_amount - advance_paid`. If `advance_paid >= total_amount`, set `payment_status = 'paid_manual_verified'`.

#### 4. `src/pages/admin/AdminOrders.tsx`
- Fetch `advance_paid, advance_payment_method` in the orders query
- In the order row: show "Advance: ₹X | Due: ₹Y" chip when `advance_paid > 0 && not fully paid`
- In the expanded detail grid: show Advance Paid + Balance Due rows

#### 5. `src/pages/admin/AdminValidate.tsx` (Gate Scanner)
- Fetch `advance_paid` in the ticket lookup query (order fields)
- Calculate `balanceDue = order.total_amount - order.advance_paid`
- Add a prominent orange/amber banner when `balanceDue > 0 && !isPaid`:
  ```
  ⚠️ BALANCE DUE: ₹996  (Advance paid: ₹3,000)
  ```
- Pre-fill `collectAmount` with `balanceDue` instead of `total_amount` when balance > 0
- Once balance collected via `admin-gate-collect`, it marks as `paid_manual_verified` correctly

#### 6. `src/pages/Ticket.tsx` — **Professional QR pass redesign**

Redesign the ticket card to exactly match the uploaded screenshot:

**Structure per ticket:**
```
┌─────────────────────────────────────────────┐
│  ✅ PAID — Entry Confirmed  (green banner)  │  ← or ⚠️ UNPAID
├─────────────────────────────────────────────┤
│  Shashank Gahtori              SEAT         │
│  India vs NZ - T20 World Cup    [1]         │
│  8/3/2026, 7:00:00 pm          of 1        │
│  Hotel Drona Palace                         │
│  Regular Seating   [if balance: ⚠️ ₹X due] │
│  ┌──────────────────────────────────┐        │
│  │         QR CODE (white bg)       │        │
│  └──────────────────────────────────┘        │
│         8449710150                           │
│         T20FN-8cb3b7f3-...                  │
│  [↓ Save QR]          [↗ Share]             │
├─────────────────────────────────────────────┤
│  🏨 Hotel Drona Palace · A Unit of SR...   6/3/2026 │
└─────────────────────────────────────────────┘
```

Key design changes from current:
- Top color strip removed → replaced by full-width gradient banner (matches screenshot exactly)
- QR sits centered with white bg and rounded corners
- Balance due badge shown under seating type if `advance_paid > 0` and not fully paid
- Footer: hotel logo + date (exactly as screenshot)
- The ticket card uses `seat-pass` existing CSS class but with refined inner layout

Also need to fetch `advance_paid` in the ticket lookup query.

**TicketData interface** → add `order.advance_paid: number`

#### 7. `src/pages/Register.tsx` (post-payment confirmation tickets)
- Similarly show balance due badge if order has advance_paid
- But for Register.tsx, there's no advance payment flow (only manual booking does this) — so this is read-only, showing the confirmed state. Low priority, skip.

---

### Backend safety
- `admin-gate-collect` already marks orders as `paid_manual_verified` and generates tickets. No change needed there — when admin collects balance at gate, the order becomes fully paid.
- The `advance_paid` / `advance_payment_method` fields are informational only; they don't affect ticket generation (tickets are generated at booking time for manual bookings).

---

### Summary of files

| File | Change |
|------|--------|
| New migration | Add `advance_paid`, `advance_payment_method` to `orders` |
| `AdminManualBooking.tsx` | Add advance paid field + mode, show balance, pass to edge fn |
| `create-order/index.ts` | Accept + store advance fields, auto-verify if fully paid |
| `AdminOrders.tsx` | Show advance/balance in order rows + detail |
| `AdminValidate.tsx` | Show balance due banner, pre-fill collect amount with balance |
| `Ticket.tsx` | Full professional pass redesign matching screenshot |

No new RLS policies needed — `advance_paid` is just a column on `orders` which already has appropriate policies.
