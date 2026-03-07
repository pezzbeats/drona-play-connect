
## Understanding

The user wants the eligibility list to store **how many seats** each mobile number is entitled to at ₹949. Currently, the `semifinal_eligibility` table has no seat count — and the pricing logic treats any eligible mobile as getting **all** requested seats at ₹949.

**Desired behavior:**
- Admin uploads CSV with `mobile, full_name, eligible_seats, notes`
- If mobile `9876543210` is in the list with `eligible_seats = 4`:
  - Seats 1–4 → ₹949 each
  - Seat 5+ → ₹999 each
- If `eligible_seats` column is blank/0 → fall back to standard logic (no eligibility)

**What needs to change:**

### 1. Database migration
Add `eligible_seats integer NOT NULL DEFAULT 0` to `semifinal_eligibility` table.

### 2. `supabase/functions/pricing-quote/index.ts`
Currently when an eligible entry is found:
```js
loyaltySeatCap = seats_count; // gives ALL seats the discount
```
Change to:
```js
loyaltySeatCap = eligibleEntry.eligible_seats; // cap = stored seat count
```
So seats beyond the cap are charged ₹999 (base_price_new).

### 3. `src/pages/admin/AdminEligibility.tsx`
- **Template CSV**: Add `eligible_seats` column → `mobile,full_name,eligible_seats,notes`
- **CSV parsing**: Parse `eligible_seats` as integer (col index 2, notes shift to col 3)
- **Preview table**: Add `Seats` column in header + rows
- **Upload payload**: Include `eligible_seats` in upsert
- **Eligibility list table**: Show `eligible_seats` column
- **Quick Check result**: Show how many seats are eligible at ₹949
- **`PreviewRow` interface**: Add `eligible_seats: number`
- **`EligibilityRow` interface**: Add `eligible_seats: number`

### Files to change
1. DB migration — add `eligible_seats` column to `semifinal_eligibility`
2. `supabase/functions/pricing-quote/index.ts` — use `eligible_seats` as the cap
3. `src/pages/admin/AdminEligibility.tsx` — CSV template, parsing, preview, table, upload, quick-check display

### Logic summary
```text
eligible_seats = 4 (stored in DB for this mobile)
requested_seats = 6

Seat 1: ₹949 (eligible)
Seat 2: ₹949 (eligible)
Seat 3: ₹949 (eligible)
Seat 4: ₹949 (eligible)
Seat 5: ₹999 (extra — beyond cap)
Seat 6: ₹999 (extra — beyond cap)
Total: 4×949 + 2×999 = ₹3,796 + ₹1,998 = ₹5,794
```

The `pricing-quote` edge function needs to select `eligible_seats` from the eligibility table instead of just `id`:
```js
const { data: eligibleEntry } = await supabase
  .from("semifinal_eligibility")
  .select("id, eligible_seats")
  .eq("mobile", mobile)
  .maybeSingle();

if (eligibleEntry) {
  loyaltySeatCap = eligibleEntry.eligible_seats ?? seats_count;
}
```

If `eligible_seats` is 0 or null on a row, we can treat it as `seats_count` (backwards compatible — all seats get discount), or strictly 0 (no discount). Given the user's logic, 0 means not eligible. But if they uploaded without the column, we should default gracefully. We'll use: if `eligible_seats > 0`, cap = `eligible_seats`; else cap = `seats_count` (full discount as before, for backward compat with old rows).

Actually re-reading: the user says "have a per mobile number of seats field" — so **0 means no specific cap, treat all as eligible**? No, the user's example is clear: 4 seats booked → 4 eligible. The field is mandatory. Old rows without it get 0 — which means they won't be eligible. That's a breaking change.

Best approach: default `eligible_seats` to `0` in the DB but in the edge function, if `eligible_seats === 0`, fall back to giving all seats the discount (backward compat). This way existing rows still work, and new uploads with a number give a specific cap.

Actually, simpler: `eligible_seats DEFAULT 0` means "no specific cap — all eligible seats". We update the template to include the column, and any new uploads will have a value. Old rows (eligible_seats = 0) → all seats get ₹949 (same as before). New rows with eligible_seats = 4 → only 4 seats at ₹949.

Edge function logic:
```js
if (eligibleEntry.eligible_seats > 0) {
  loyaltySeatCap = eligibleEntry.eligible_seats;
} else {
  loyaltySeatCap = seats_count; // no cap — all seats eligible (legacy)
}
```
