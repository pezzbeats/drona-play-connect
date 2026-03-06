
## What Already Exists vs. What Needs Building

The previous edit already added the eligibility badge to Step 2 (pricing). The existing system has `semifinal_eligibility` table, the upload page, and the `pricing-quote` edge function checking it. The prompt is a broader feature request that includes several improvements on top of what's there.

### Gaps to fill:

1. **Schema**: `semifinal_eligibility` table is missing `full_name` and `notes` columns — needs a migration
2. **Template CSV**: Currently only exports `mobile` — needs `mobile,full_name,notes` columns
3. **CSV parsing**: Needs to read `full_name` and `notes` from the uploaded file
4. **Upload mode**: No Replace vs. Append choice — needs a toggle
5. **Clear all list**: No bulk-clear with confirmation
6. **Export current list**: No way to download existing records as CSV
7. **Seat reason labels**: Step 2 shows raw reason codes (`loyal_base`, `semifinal_attendee`) — should show "Special ₹949 eligible" or "Standard ₹999"
8. **Admin Orders view**: Pricing source badge ("Special ₹949" / "Standard ₹999") missing

---

### Changes

**1. Database migration** — add `full_name text` and `notes text` (both nullable) to `semifinal_eligibility`

**2. `AdminEligibility.tsx`** — full overhaul:
- Template now exports `mobile,full_name,notes` with example rows
- CSV parser reads the `full_name` and `notes` columns in addition to `mobile`
- Upload payload includes `full_name` and `notes`
- Preview table shows all three columns (mobile, name, notes) with valid/invalid indicator
- **Upload mode toggle**: "Append to existing" (default) vs "Replace all" (clears first with a warning banner)
- **Clear All** button at bottom of list with AlertDialog confirmation
- **Export List** button — downloads all current records as CSV

**3. `Register.tsx` (Step 2 price breakdown)** — improve reason label display:
- `semifinal_attendee` → `"⭐ Special ₹949"`
- `loyal_base` → `"⭐ Returning rate"`
- `extra_seat` → `"Standard rate"`
- `new_customer` → `""` (no badge, clean)

**4. `AdminOrders.tsx`** — add pricing source badge in the seat/price column:
- Read `pricing_model_snapshot` from order
- If any seat has reason `semifinal_attendee` or `loyal_base` → show green "Special ₹949" badge
- Otherwise → show muted "Standard ₹999" badge

### Files to modify
| File | Change |
|---|---|
| `supabase/migrations/new.sql` | Add `full_name`, `notes` to `semifinal_eligibility` |
| `src/pages/admin/AdminEligibility.tsx` | Template, parsing, replace/append, clear all, export |
| `src/pages/Register.tsx` | Friendly reason labels in price breakdown |
| `src/pages/admin/AdminOrders.tsx` | Pricing source badge |
