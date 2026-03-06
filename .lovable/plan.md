
## Plan: CSV Export for Razorpay Transactions Tab

### What to change
Single file edit: `src/pages/admin/AdminPayments.tsx`

### Implementation

1. **Add `Download` icon** to the existing lucide-react import line (alongside `RefreshCw`, `Search`, etc.)

2. **Add `exportCSV` function** inside `TransactionsTab` — pure client-side, no new dependencies needed:
   - Takes the current `filtered` array (respects active search + filter)
   - Builds CSV rows with these 7 columns: `Date`, `Customer Name`, `Mobile`, `Amount (INR)`, `Payment ID`, `Order ID`, `Status`
   - Escapes values that may contain commas by wrapping in double quotes
   - Creates a Blob with `text/csv` MIME type
   - Uses `URL.createObjectURL` + a temporary `<a>` click to trigger browser download
   - Filename: `razorpay-transactions-YYYY-MM-DD.csv` (today's date)
   - Shows `toast.success` with the row count: "Exported 12 transactions"
   - Disabled when `filtered.length === 0` or `loading`

3. **Add Export button** in the controls row (alongside Refresh button):
   - `variant="outline"` size `sm`
   - Icon: `Download` (h-3.5 w-3.5)
   - Label: `Export CSV`
   - Disabled when loading or no filtered results
   - Tooltip note via `title` attribute: shows count like "Export 12 rows"

### CSV column mapping

| CSV column | Source field |
|---|---|
| Date | `format(new Date(o.created_at), 'dd MMM yyyy HH:mm')` |
| Customer Name | `o.purchaser_full_name` |
| Mobile | `o.purchaser_mobile` |
| Amount (INR) | `o.total_amount` (plain number, no ₹ symbol) |
| Payment ID | `o.razorpay_payment_id ?? ''` |
| Order ID | `o.razorpay_order_id ?? ''` |
| Status | `o.payment_status` |

### Files changed
- `src/pages/admin/AdminPayments.tsx` — add `exportCSV` function + `Download` import + Export button in controls bar

No backend changes, no new dependencies, no migration needed. Pure frontend.
