
## Analysis of Current System

**QR payload today:**
- `T20FN-{matchId[0:8]}-{mobile}-S{seatIndex+1}-{timestamp}-{randomHex}` — plain text, stored in `tickets.qr_text`
- Looked up directly with `eq('qr_text', qrText)` from the frontend client

**What already works well:**
- `tickets.status` enum: `active | used | blocked` — the states are correct
- `mark_ticket_checkin` DB RPC handles race conditions with `FOR UPDATE` lock ✅
- `admin-checkin` edge function already checks for `blocked` in the RPC
- `blocked_reason` column exists on tickets ✅

**Real security gaps to address:**

1. **No scan attempt logging** — reuse attacks are silent; no audit trail of who scanned what and when
2. **Block/Unblock/Reissue in AdminValidate** — UI has no controls; these actions are impossible for admins today
3. **Mismatched match detection in scanner** — `lookupTicket` does not check if scanned ticket's `match_id` matches the currently active match
4. **Blocked ticket check in AdminValidate** — the page only checks `isPaid` and `isCheckedIn`; a blocked ticket shows the "Check In" button
5. **QR payload encryption** — current format embeds mobile number in plain text in the QR; while functional, a HMAC signature appended to the payload prevents tampering/forgery
6. **"Reissue QR" action** — generates a new QR for a ticket (invalidating the old one), needed when a screenshot is potentially compromised

**What NOT to change:**
- QR lookup mechanism (already works with the admin camera/paste flow)
- Visual styling (no style changes per instructions)
- User-facing ticket page (no visible change to /ticket)
- Check-in flow logic (already correct)

---

## Plan

### Part 1 — DB migration: `ticket_scan_log` table
New table to record every scan attempt (pass or fail):

```sql
CREATE TABLE public.ticket_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  qr_text_hash text NOT NULL,          -- SHA-256 of scanned QR (not raw text)
  ticket_id uuid,                       -- NULL if no ticket found
  match_id uuid,
  scanned_by_admin_id uuid,
  outcome text NOT NULL,                -- 'ok' | 'reuse_blocked' | 'not_found' | 'blocked_ticket' | 'match_mismatch' | 'unpaid'
  ip_address text
);
-- RLS: insert by authenticated only (admin gate scanner)
-- SELECT by authenticated only
```

No FK on `ticket_id` (nullable — ticket might not exist for failed scans).

### Part 2 — HMAC-signed QR payload (tamper-evident, not encrypted)

**Why HMAC not encryption:** The QR must be human-scannable by off-the-shelf scanner apps at the gate. Encryption would produce binary garbage. A HMAC signature appended to the payload means:
- The payload is still readable
- Any tampering/forgery produces a signature mismatch
- The secret key never leaves the server

**New QR format** (generated in edge functions):
```
T20FN-{matchId[0:8]}-{mobile}-S{n}-{ts}-{rand}-SIG:{hmac[0:16]}
```

HMAC-SHA256 computed over `T20FN-{matchId[0:8]}-{mobile}-S{n}-{ts}-{rand}` using a server-side secret (`QR_HMAC_SECRET`).

**Where this applies:**
- `create-order` edge function (for `pay_at_hotel`/`cash` tickets)
- `verify-payment-proof` edge function (ticket gen on verified payment)
- `AdminOrders.tsx` manual verify (also generates tickets)
- New `reissue-qr` edge function (Part 4)

**HMAC secret:** Use existing `LOVABLE_API_KEY` as the HMAC secret (already set), OR add a dedicated `QR_HMAC_SECRET`. Use `LOVABLE_API_KEY` since no new secret input is needed.

**Validation in `admin-checkin` (or new lookup function):** Before check-in, verify HMAC signature. If mismatch → reject as `tampered`.

**Backward compatibility:** Old tickets (without `-SIG:`) continue to work — scanner skips HMAC check if `-SIG:` segment absent (grace period). New tickets always get HMAC.

### Part 3 — `AdminValidate.tsx` hardening

**Add scan attempt logging** on every `lookupTicket()` call:
- After lookup, call new `log-ticket-scan` edge function (or inline call to `ticket_scan_log` via authenticated supabase insert)
- Log: `qr_text_hash` (SHA-256 of scanned text, not raw), `ticket_id`, `match_id`, `scanned_by_admin_id`, `outcome`

**Add active match mismatch check:**
- When ticket is found, compare `ticketData.match_id` against the currently active match
- If mismatch: show a clear warning card ("⚠️ Wrong Match — this ticket is for [match name]") and block the check-in button

**Add blocked ticket display:**
- Currently `isCheckedIn = status === 'used'`, but `status === 'blocked'` is not handled specially
- Add `isBlocked = ticketData?.status === 'blocked'` state
- Show a red warning card with `blocked_reason` when blocked
- Block the check-in button

**Add admin controls panel** (shown for paid + active/used/blocked tickets):
- **Block Ticket** button — opens inline form asking for `blocked_reason` (required, min 5 chars), then calls `supabase.from('tickets').update({ status: 'blocked', blocked_reason })`.eq('id', ticketData.id)`
- **Unblock Ticket** button (shown only when status = 'blocked') — sets status back to `active`, clears `blocked_reason`
- **Reissue QR** button — calls new `reissue-qr` edge function (Part 4), refreshes lookup

All three actions: require reason (for block), log to `admin_activity`.

### Part 4 — `reissue-qr` edge function

New edge function `supabase/functions/reissue-qr/index.ts`:
1. Validate admin JWT (same pattern as `admin-checkin`)
2. Fetch ticket, validate it's not `used` (can't reissue a checked-in ticket)
3. Generate new QR text with HMAC signature using `generateSignedQR()`
4. Update `tickets.qr_text` to the new value (old QR is now dead)
5. Log to `admin_activity`: `action: 'reissue_qr', entity_id: ticket_id, meta: { old_qr_hash, new_qr_hash, admin_id }`
6. Return new QR text so `AdminValidate` can refresh the display

### Part 5 — `create-order` + `verify-payment-proof` + `AdminOrders` QR generation upgrade

Update `generateQRText` / ticket generation in all three places to use `generateSignedQR()` that appends HMAC. This is a pure logic change in the edge functions — no DB schema change.

The HMAC function uses `crypto.subtle.importKey` + `HMAC-SHA256` (available in Deno/Edge).

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | New `ticket_scan_log` table with RLS |
| `supabase/functions/create-order/index.ts` | HMAC-signed QR generation |
| `supabase/functions/verify-payment-proof/index.ts` | HMAC-signed QR generation |
| `supabase/functions/admin-checkin/index.ts` | HMAC signature validation on check-in; log scan attempt |
| `supabase/functions/reissue-qr/index.ts` | New: reissue QR with new HMAC-signed payload |
| `src/pages/admin/AdminOrders.tsx` | HMAC QR in manual-verify ticket gen |
| `src/pages/admin/AdminValidate.tsx` | Scan logging, match mismatch check, blocked ticket UI, block/unblock/reissue controls |

---

## What this achieves

| Requirement | Implementation |
|---|---|
| QR unique per seat | Already true; HMAC adds tamper-evidence |
| Encrypted/tamper-evident payload | HMAC-SHA256 signature suffix |
| Reuse detection | `status = 'used'` already enforced by `mark_ticket_checkin` RPC with `FOR UPDATE` lock |
| Match mismatch detection | `AdminValidate` compares `ticketData.match_id` vs active match |
| Blocked ticket detection | `AdminValidate` shows blocked state, blocks check-in |
| Payment status clearly shown | Already shown; blocked/mismatch warnings added |
| Scanner logs all attempts | New `ticket_scan_log` table + insert on every scan |
| Admin block ticket | New inline form in `AdminValidate` |
| Admin unblock ticket | New button in `AdminValidate` |
| Admin reissue QR | New `reissue-qr` edge function + button in `AdminValidate` |
| No visual style changes | All new UI uses existing `GlassCard`/`GlassButton` components |
