
## Plan: ₹999 Pricing + Semifinal Eligibility Upload & Check

### What we're building
1. **Set pricing** for the active match: ₹999 per seat (new), ₹949 per seat (semifinal attendees)
2. **New DB table** `semifinal_eligibility` — stores pre-approved mobile numbers uploaded by super admin
3. **Admin CSV Upload section** — super_admin-only page (new route `/admin/eligibility`) where they can download a blank template CSV and upload a filled one
4. **Eligibility check in `pricing-quote`** — reads `semifinal_eligibility` to grant the ₹949 rate instead of order history
5. **Live eligibility badge on Register page** — after a valid 10-digit mobile is entered, instantly queries and shows "✅ Semifinal attendee — ₹949/seat" or "Regular price — ₹999/seat"

---

### Database changes

**New table: `semifinal_eligibility`**
```text
id          uuid PK
mobile      text UNIQUE NOT NULL
uploaded_by uuid (admin user id)
uploaded_at timestamptz DEFAULT now()
match_label text (e.g. "India vs NZ Semi Final")
```
RLS: readable by all (for eligibility checks), writable only by authenticated (admins).

**Update pricing**: Run SQL to upsert `match_pricing_rules` for the active match:
- `base_price_new = 999`
- `base_price_returning = 949`
- `rule_type = 'standard'` (no loyalty_from_match_id — use the new eligibility table instead)

---

### `pricing-quote` edge function update

Change the returning-customer logic to **also check `semifinal_eligibility`** table:

```text
IF mobile is in semifinal_eligibility → loyaltySeatCap = seats_count (all seats at ₹949)
ELSE → standard new customer at ₹999
(keep old order-history logic as fallback for future matches)
```

The `reason` label for eligible seats becomes `"semifinal_attendee"`.

---

### New Admin page: `AdminEligibility.tsx`

Route: `/admin/eligibility` — **super_admin only**

UI sections:
1. **Stats strip** — total uploaded numbers, last upload time
2. **Download Template** button — generates a CSV file in-browser: `mobile` column header + 2 example rows
3. **Upload CSV** — file input that parses the CSV client-side, validates each row is a 10-digit number, shows a preview table (first 10 rows + count), then bulk-upserts into `semifinal_eligibility`
4. **Current list** — paginated table of uploaded numbers with delete capability

---

### Register page update

In **Step 0** (personal details), after the mobile field shows valid (10 digits), trigger a lightweight check against `semifinal_eligibility`:

```text
useEffect: debounced 400ms after mobileValid changes to true
→ SELECT count from semifinal_eligibility WHERE mobile = ?
→ Show inline badge:
   ✅ Semifinal attendee — you qualify for ₹949/seat
   or
   Standard pricing — ₹999/seat
```

This is shown **below the mobile field** as a soft info banner (green vs neutral), before they reach the pricing step.

---

### Admin sidebar

Add "Eligibility" link to the admin sidebar under super_admin section.

---

### Files to create/modify

| File | Change |
|---|---|
| `supabase/migrations/...sql` | Create `semifinal_eligibility` table + RLS |
| `supabase/functions/pricing-quote/index.ts` | Check `semifinal_eligibility` for discount |
| `src/pages/admin/AdminEligibility.tsx` | New page — template download + CSV upload + list |
| `src/App.tsx` | Add route `/admin/eligibility` (super_admin protected) |
| `src/components/admin/AdminSidebar.tsx` | Add Eligibility nav link |
| `src/components/admin/AdminBottomNav.tsx` | Add Eligibility nav item |
| `src/pages/Register.tsx` | Add eligibility badge below mobile field |
| DB data update | Set pricing rule: ₹999 new / ₹949 returning for active match |
