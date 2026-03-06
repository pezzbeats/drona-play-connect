
## Analysis of current state

**Already done (don't re-do):**
- SHA-256 file hash duplicate detection ✅
- TXN ID duplicate detection (only checks `ai_verdict = 'verified'` rows) ✅
- AI extraction of amount, TXN ID, VPA, date ✅
- Amount mismatch → `needs_manual_review`, not auto-verify ✅
- Manual verify/reject buttons in `AdminOrders.tsx` (no reason required) — needs hardening
- `admin_activity` logging on manual actions ✅

**Gaps to fill:**
1. **Amount + mobile within 30-min window check** — not implemented
2. **TXN ID duplicate check only covers `verified` proofs** — should also block `needs_manual_review` pending ones (same TXN ID uploaded twice)
3. **Admin override requires a reason** — currently buttons fire immediately with no reason prompt
4. **Audit trail** on `payment_proofs` — no `admin_override_reason`, `overridden_by`, `overridden_at` columns
5. **Ticket generation gate** — `verify-payment-proof` generates tickets; `create-order` also generates for `pay_at_hotel`. This is correct behavior but the ticket-gen path in `verify-payment-proof` doesn't check existing tickets correctly (uses `tickets(id)` join on order2 but this could fail)
6. **PDF support** — AI extraction is gated on `file.type.startsWith("image/")` — PDFs are silently queued as `needs_manual_review` without even trying extraction
7. **Confidence field** — no confidence score stored, low-confidence cases have no signal
8. **View proof image from admin** — admin can't see the uploaded screenshot inline; no signed URL

---

## Plan

### Part 1 — DB migration
New columns on `payment_proofs`:
- `overridden_by_admin_id uuid`
- `overridden_at timestamptz`
- `override_reason text`
- `ai_confidence text` (high/medium/low/none — stored as text)
- `fraud_flags jsonb DEFAULT '[]'` — array of flag strings set by backend

No new tables needed. Audit of who changed what is captured in both `payment_proofs.overridden_by_admin_id` + the existing `admin_activity` table.

### Part 2 — `verify-payment-proof` edge function hardening
Add the missing fraud/duplicate checks in order:

1. **File hash dupe** (already done — keep)
2. **TXN ID dupe — expanded**: check ALL proofs with same `extracted_txn_id` (not just `ai_verdict = 'verified'`) to catch re-upload of the same receipt in `needs_manual_review` state
3. **NEW: Amount + mobile within 30-min window**: if another proof exists for the same `purchaser_mobile` and same `extracted_amount` submitted within last 30 minutes for a different order → add `"amount_mobile_window"` to `fraud_flags` and force `needs_manual_review`
4. **VPA mismatch** → if extracted VPA doesn't contain the expected payee prefix, add `"vpa_mismatch"` to fraud_flags
5. **Improve ticket generation safety**: wrap in check `tickets.count === 0` using a separate count query rather than joining (the current join approach can fail if the select with `tickets(id)` returns stale data)
6. **Store ai_confidence**: map from extracted data quality — `high` if all 4 fields extracted + status=success, `medium` if 3 fields, `low` if 2 or fewer, `none` if extraction failed

### Part 3 — `AdminOrders.tsx` — require reason for admin overrides
Replace the direct `handleManualVerify` call with an inline reason dialog:

- When admin clicks **Manual Verify** or **Reject**, open a small inline form asking for a reason (required, min 5 chars, textarea)
- On submit: write `override_reason`, `overridden_by_admin_id = user.id`, `overridden_at = now()` to the latest `payment_proof` row for that order AND log to `admin_activity` with meta `{ reason }`
- Also generate tickets on manual verify if none exist yet (currently missing — manual verify updates order status but never generates tickets)

### Part 4 — `AdminOrders.tsx` — view proof image inline
Add a "View Proof" link in the expanded proof panel that generates a signed URL for the file in `payment-proofs` storage bucket and opens it in a new tab.

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | Add 5 columns to `payment_proofs` |
| `supabase/functions/verify-payment-proof/index.ts` | Full rewrite with enhanced fraud checks, ai_confidence, improved TXN dupe logic, safe ticket gen |
| `src/pages/admin/AdminOrders.tsx` | Reason dialog for overrides, ticket gen on manual verify, view proof signed URL |

---

## Technical detail for non-technical readers

- **What changes for users**: Nothing. The registration flow is identical. Behind the scenes, more fraud signals are captured.
- **What changes for admins**: The "Manual Verify" and "Reject" buttons now require typing a brief reason before confirming (like a confirmation step). Admins will also see a "View Proof" button to open the payment screenshot. The fraud flags column shows why AI flagged a payment.
- **New fraud checks**: If the same amount from the same mobile is uploaded within 30 minutes for two different orders, the system flags it for manual review instead of auto-verifying. If the same transaction ID is recycled, it's blocked immediately.
