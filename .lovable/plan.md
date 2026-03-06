
## Plan: Eligibility Discount Badge on Step 3

### What needs changing

There are **two visible areas in Step 3**:

1. **Payment method selector** (`select_method` state, lines 843–848) — the "Total Amount" prominent block already shows the total. The eligibility badge should appear just below this total amount box.

2. **Pre-payment summary** (`razorpay_summary` state, the `PrePaymentSummary` component) — the order summary card (lines 101–128) shows a rows-based breakdown but only shows "Total Payable" at the bottom with no seat-by-seat breakdown or eligibility indicator. The badge and per-seat breakdown should appear here.

### Changes to make

**1. `PrePaymentSummary` component (lines 83–88, 101–128)**
- Add `eligibilityStatus` and `priceQuote` as new props
- Insert the eligibility banner (green star badge for eligible, muted info for standard) between the header and the order summary card
- Replace the static `Seats: N × type` row with a small per-seat breakdown from `priceQuote.seats` — the same readable labels used on Step 2 (`⭐ Special ₹949 eligible`, `Standard rate`, etc.)

**2. `select_method` panel (lines 843–848)**
- Add the eligibility badge directly under the "Total Amount" box so eligible users see it even before picking a method
- Eligible: green star banner — "⭐ Semifinal attendee discount applied — seats at ₹949"
- Standard: a subtle muted note — "Standard pricing — ₹999/seat"

**3. Pass new props at the call site (line 755–763)**
- Add `eligibilityStatus={eligibilityStatus}` and `priceQuote={priceQuote}` to the `<PrePaymentSummary>` component call

### Files to modify
- `src/pages/Register.tsx` only — three small edits within the same file:
  1. Update `PrePaymentSummary` prop interface + render
  2. Update the call site to pass the new props
  3. Add badge under Total Amount in `select_method`
