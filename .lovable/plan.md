
## Analysis of All Issues

### Issue 1: Scan button doesn't work — `collectMethod` type mismatch sends `"upi"` to the edge function

The scan flow works fine, but when collecting payment:
- `collectMethod` state is typed as `'cash' | 'upi' | 'card'`
- The method buttons use `{ id: 'upi', ... }` 
- `handleCollect` passes `method: collectMethod` to `admin-gate-collect`
- `admin-gate-collect` inserts `method` directly into `payment_collections.method` which is a `payment_method_enum`
- The enum has `upi_qr`, not `upi`

**This is the same enum bug as the manual booking form** — so "Record UPI Payment" fails with a DB error.

But the user says "scanning button isn't working" — the **primary Scan button** (`lookupTicket`) hits Supabase REST directly for `tickets` with `.eq('qr_text', trimmed)`. If the QR field value has trailing whitespace, or the `qr_text` isn't matching, nothing shows. Looking at the input: it uses `onChange` but **no auto-scan on Enter for keyboard scanners properly** — the `onKeyDown` only fires if someone types. More critically: the scan button calls `lookupTicket(qrInput)` but `qrInput` state may not be updated yet when button is clicked (React batching). Using a `ref` to get the latest value vs. stale closure state would fix this.

Actually the bigger issue: on mobile QR scanners that type-in characters, the input `onChange` fires but `qrInput` is stale in the button closure. The `onKeyDown` fires with the stale `qrInput` too. The fix: use `useRef` to track the current value or read from the input DOM element directly.

**Root cause of scan not working**: The `lookupTicket` is called with `qrInput` (state), but when a hardware QR scanner rapidly types characters and hits Enter, the `onKeyDown` fires with `e.key === 'Enter'` calling `lookupTicket(qrInput)` — but `qrInput` state hasn't updated yet because it's a stale closure. Need to pass `e.currentTarget.value` or use a ref.

### Issue 2: Balance amount check on scanning

Currently the balance due banner (line 554) only shows when `advancePd > 0 && balanceDue > 0 && !isPaid`. This means a ticket with **zero advance (fully unpaid)** shows no balance alert. Should show for ALL unpaid/partial orders.

Also the `canCheckIn` variable (line 365) requires `isPaid` — so `pay_at_hotel` or unpaid orders can't be checked in. But the user wants balance check & collection **upon scanning**, meaning an unpaid guest should still be able to be checked in **after** collecting payment — so the flow needs to: show balance → collect → then auto-enable check-in after payment.

### Issue 3: PIN generation after check-in

The `admin-checkin` edge function only generates a PIN if the ticket exists and the order has a `match_id`. But if `matchId` is null (orders where `match_id` isn't populated in the `orders` relation lookup), `game_access.upsert` fails silently because `match_id` would be null (not-null constraint on the table).

The edge function fetches: `tickets.select("*, orders(purchaser_mobile, match_id, ...)")` — but `orders` is a foreign key relation accessed via `orders(...)` not `order:orders!order_id(...)`. The join key may be ambiguous if there's no explicit FK. Let me verify this is actually correct — it should work since `order_id` FK exists.

Actually the deeper PIN issue: `canCheckIn` requires `isPaid` (line 365). For `pay_at_hotel` orders, the payment_status is `unpaid` — they never become `isPaid` until explicitly collected. But check-in + PIN generation should be available even for `pay_at_hotel` or after gate collection. So the check-in card with PIN is hidden for unpaid tickets (`{isPaid && (... Check-In & PIN ...)}` at line 618). 

**Fix**: Allow check-in for `pay_at_hotel` payment method even if not paid yet, OR show the collect-then-checkin flow more prominently.

### Summary of all fixes needed:

**Fix 1: Scan button stale state** — In `lookupTicket` call on button click, read from `inputRef.current.value` directly instead of state. Also fix `onKeyDown` to use `e.currentTarget.value`.

**Fix 2: `collectMethod` enum value** — Change `'upi'` to `'upi_qr'` everywhere in AdminValidate (state type, button ids, display labels keep "UPI").

**Fix 3: Balance due banner** — Show balance due for ALL non-paid orders, not just those with advance > 0. Also show total amount as balance for fully-unpaid orders.

**Fix 4: Balance amount in collection section** — Show the full total for unpaid orders (no advance), not just partial balance. Pre-fill amount with correct receivable.

**Fix 5: Check-in & PIN for pay_at_hotel** — Change `canCheckIn` and the PIN section visibility to also allow check-in for orders with `payment_method === 'pay_at_hotel'` even when status is `unpaid` (they pay at gate, and the gate collect button handles marking as paid). After collecting at gate, order becomes `paid_manual_verified` — then they can check in. The UX flow should be: collect → refresh → check-in. This is already almost right, but the `{isPaid && ...}` gate at line 618 blocks it.

Actually, simplest for `pay_at_hotel`: allow the check-in block to also show when `order.payment_method === 'pay_at_hotel'` even if not paid (with a notice "collect payment first"). Better yet: show a combined "Collect & Check-In" flow.

### Plan

**File: `src/pages/admin/AdminValidate.tsx`**
1. Fix scan button: use `inputRef.current?.value` in `onClick` and `onKeyDown` instead of stale `qrInput` state
2. Fix collectMethod type: `'cash' | 'upi_qr' | 'card'`, button ids from `'upi'` to `'upi_qr'`, placeholder still says "UPI"
3. Fix balance due banner: remove the `advancePd > 0` guard — show for ANY non-paid order
4. Fix balance pre-fill: for fully-unpaid orders (no advance), pre-fill with `total_amount` not 0
5. Fix PIN section: show check-in card for `pay_at_hotel` orders too (with "collect payment first" note if not paid yet). Change `{isPaid && ...}` to `{(isPaid || order.payment_method === 'pay_at_hotel') && ...}`, and `canCheckIn` should allow `pay_at_hotel` after collection marks it paid.

**File: `supabase/functions/admin-gate-collect/index.ts`**  
The `method` field is passed directly from the client — if client sends `'upi_qr'` after our fix, it works. No change needed here since the fix is in the frontend.

### Files Changed
| File | Changes |
|------|---------|
| `src/pages/admin/AdminValidate.tsx` | Fix scan stale state, fix `upi`→`upi_qr` enum value, fix balance banner visibility, fix pay_at_hotel check-in flow |
