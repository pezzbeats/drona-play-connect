
# T20 Fan Night Ops Suite — Phase 1 Plan
## React + Supabase | Premium Glassmorphism | Mobile-First

---

### What We're Building (Phase 1)

**Ticketing, Payments, Admin Core Operations**

---

## 🗄️ Database (Supabase / PostgreSQL)

Set up all Phase 1 tables via migrations:

- **`admins`** — id, full_name, email, password_hash, role (super_admin / admin / counter_staff), is_active
- **`admin_activity`** — audit log: admin_id, action, entity_type, entity_id, meta, ip_address
- **`events`** — id, name, venue, is_active
- **`matches`** — id, event_id, name, opponent, match_type, status, is_active_for_registration (partial unique index: only 1 active allowed), prediction_mode, disclaimer_enabled
- **`match_assets`** — match_id, asset_type (banner, poster, team flags, terms PDF, seating map), file_path
- **`match_pricing_rules`** — match_id, rule_type (standard/loyalty), base_price_new, base_price_returning, loyalty_from_match_id
- **`orders`** — match_id, purchaser details, seating_type, seats_count, total_amount, pricing_model_snapshot, payment_method, payment_status, created_source
- **`order_seat_pricing`** — per-seat price breakdown
- **`tickets`** — match_id, order_id, seat_index, qr_text (unique), status (active/used/blocked), checked_in_at, checked_in_by_admin_id
- **`payment_proofs`** — order_id, file_path, file_sha256 (unique), extracted fields, ai_verdict, ai_reason
- **`payment_collections`** — on-gate collection by admin
- **`game_access`** — match_id, ticket_id, mobile, pin_hash, is_active (unique per match+ticket)

Enforce: partial unique index so only one match can have `is_active_for_registration = true` at a time.

Seed: 1 event ("T20 Fan Night", Hotel Drona Palace) + 1 super_admin (credentials logged to console).

---

## ⚙️ Supabase Edge Functions

1. **`pricing-quote`** — Given mobile, seats_count, seating_type: compute per-seat pricing (new/returning/loyalty rules), return seat-by-seat breakdown + total
2. **`create-order`** — Creates order + tickets in a transaction; blocks if payment not OK (unless pay_at_hotel)
3. **`verify-payment-proof`** — Uploads file, computes SHA-256 (blocks duplicate files), uses Lovable AI (Gemini Vision) to extract txn ID / amount / VPA / date from screenshot or PDF; blocks duplicate txn IDs; validates amount + payee VPA; returns verdict
4. **`admin-checkin`** — Validates QR ticket, marks checked_in, generates 4-digit gameplay PIN, returns WhatsApp message text
5. **`admin-gate-collect`** — Records payment collection at gate (cash/UPI/card) with reference + optional proof upload
6. **`set-match-active`** — Transaction: sets all matches to inactive, then activates chosen one

---

## 🌐 Public Pages (Glassmorphism, Mobile-First)

### `/register` — Customer Registration
- Fetches active match info + assets (banner, seating map, terms)
- Shows match closed state if no active match
- Step 1: Enter name, mobile, email (optional)
- Step 2: Seat count + seating type selector; real-time price quote (seat-by-seat table)
- Step 3: Payment choice — "Pay at Hotel" OR "UPI QR" (dynamic QR with amount + remark `NAME_SEATS_MOBILE`)
- If UPI: show QR, then upload payment screenshot/PDF → live verification feedback
- Step 4: Ticket generation (only when verified or pay-at-hotel)
- No gambling disclaimer shown persistently

### `/ticket?token=…` — Seat Passes
- Shows N passes (one per seat) — each with QR code, seat number, customer name, match info
- Paid / Unpaid badge per pass
- Clean print/share layout

### `/play` — Gameplay Login (Phase 2 prep)
- Mobile + 4-digit PIN entry
- Validates via game_access table
- Issues game_token cookie, redirects to `/live`

---

## 🔐 Admin Pages (Glassmorphism Sidebar Layout)

### `/admin/login`
- Email + password auth (Supabase Auth for admins)
- Role-based redirect

### `/admin/dashboard`
- Stats: total registrations, paid vs unpaid, check-ins today, seats sold
- Quick action buttons

### `/admin/matches`
- List all matches with status badges
- Create new match
- Toggle "Active for Registration" (one at a time — transaction enforced)

### `/admin/matches/:id`
- Edit match details (name, opponent, type, start time, venue, status)
- Upload match assets (banner, poster, team flags, seating map, terms PDF) via Supabase Storage
- Set pricing rules (standard + optional loyalty rule linked to a past match)

### `/admin/manual-booking`
- Search by mobile to check existing registration
- Same quote form as public registration
- Force-create order with any payment method
- Audit logged

### `/admin/validate` — Gate Operations
- QR code scanner (camera)
- Shows: customer name, seat count, paid/unpaid status, check-in status
- If unpaid: collect payment form (cash/UPI/card + reference + optional proof upload + AI verify)
- Check-in button: marks ticket used, generates 4-digit PIN
- Shows PIN + "Copy WhatsApp Message" button (no API — copies text to clipboard)
- PIN regeneration button

### `/admin/orders`
- Searchable list of all orders
- Filter by match, status (paid/unpaid/pending)
- Click order to see details, payment proof, and manual verify/reject button

---

## 🎨 Design System

- **Glassmorphism**: frosted glass cards (`backdrop-blur`, semi-transparent backgrounds), soft gradient backgrounds (deep navy/purple/indigo), glowing accents
- **Color palette**: Deep space navy base + electric blue/cyan accents + amber for warnings + green for success
- **Typography**: Modern, clean — large headings, readable body
- **Mobile-first**: All pages stack cleanly on 375px screens
- **Components**: Reusable GlassCard, GlassButton, StatusBadge, QRDisplay, SeatPricingTable

---

## 📋 Phase 2 Preview (not built now)
- Live match engine (innings/overs/deliveries)
- Prediction windows
- Leaderboard
- Realtime Supabase subscriptions for scoreboard
