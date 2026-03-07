

## Issues Found

### 1. Register.tsx — eligibility badge fetches only `id`, not `eligible_seats`
The debounced mobile check (step 0) queries `select('id')` only. It can't tell the user how many seats are at the discounted rate. The badge always says "₹949/seat" regardless of the cap.

### 2. Register.tsx — PriceQuote interface missing new fields
The `PriceQuote` interface doesn't include `is_semifinal_eligible` or `loyalty_seat_cap` returned by the edge function, so UI can't use the cap to show accurate messaging.

### 3. Register.tsx — eligibility badge copy doesn't reflect the seat cap
Both Step 0 and Step 1 badges say "₹949/seat" broadly. With the cap system, should say e.g. "2 seats at ₹949, extras at ₹999".

### 4. AdminEligibility.tsx — Export CSV missing `eligible_seats` column
The export function builds header as `mobile,full_name,notes,match_label,uploaded_at` — `eligible_seats` is absent.

---

## What to Fix

### `src/pages/Register.tsx`

**a) Eligibility state** — store `eligible_seats` alongside the status:
```typescript
const [eligibleSeats, setEligibleSeats] = useState<number>(0);
```

**b) Debounced check** — fetch `id, eligible_seats` instead of just `id`:
```typescript
const { data } = await supabase
  .from('semifinal_eligibility')
  .select('id, eligible_seats')
  .eq('mobile', mobile)
  .maybeSingle();
setEligibilityStatus(data ? 'eligible' : 'standard');
setEligibleSeats(data?.eligible_seats ?? 0);
```

**c) PriceQuote interface** — add missing fields:
```typescript
interface PriceQuote {
  seats: Array<{ seat_index: number; price: number; reason: string }>;
  total: number;
  seating_type: string;
  is_semifinal_eligible?: boolean;
  loyalty_seat_cap?: number;
}
```

**d) Step 0 badge copy** — show accurate cap info:
- If `eligible_seats > 0`: "X seats at ₹949, extras at ₹999"
- If `eligible_seats === 0` (legacy all-eligible): "All seats at ₹949"

**e) Step 1 badge copy** — mirror same logic using `eligibleSeats` state.

### `src/pages/admin/AdminEligibility.tsx`

**Fix export** — add `eligible_seats` to the export CSV:
```typescript
const header = 'mobile,full_name,eligible_seats,notes,match_label,uploaded_at';
const body = rows.map(r => [
  r.mobile,
  r.full_name ?? '',
  r.eligible_seats,
  r.notes ?? '',
  r.match_label ?? '',
  r.uploaded_at,
].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
```

---

## Files Changed

1. `src/pages/Register.tsx` — eligibility state, debounced query, interface, badge copy (4 targeted edits)
2. `src/pages/admin/AdminEligibility.tsx` — export header + row (1 targeted edit)

No backend/migration changes needed — the edge function and DB schema are already correct.

