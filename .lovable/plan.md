
## Plan: Razorpay Integration + Legal Pages Upgrade

### Overview
This is a large feature addition touching the payment flow, 3 new edge functions, a DB migration, 4 new/upgraded legal pages, a new Contact Us page, a Pricing page, and footer updates.

---

### Part 1 — Database Migration

Add these columns to `orders` table:
- `razorpay_order_id text`
- `razorpay_payment_id text`
- `razorpay_signature text`
- `gateway_response jsonb` (snapshot of Razorpay response)

The `payment_method` enum already has values; we need to add `razorpay` to the `payment_method` enum used by the orders table. Check current enum — it has `pay_at_hotel`, `cash`, `card`, `upi_qr`. We need to add `razorpay`.

Migration SQL:
```sql
ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'razorpay';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_signature text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gateway_response jsonb;
```

---

### Part 2 — Razorpay Secrets

Need `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` stored as Supabase secrets. Will use `add_secret` tool to request them from the user before the edge functions can work.

---

### Part 3 — New Edge Functions

**`supabase/functions/razorpay-create-order/index.ts`**
- Accepts: `{ order_id, amount_paise, currency, receipt }` 
- Creates a Razorpay order via Razorpay API (`https://api.razorpay.com/v1/orders`)
- Returns: `{ razorpay_order_id, amount, currency, key_id }`
- Stores `razorpay_order_id` on the `orders` row

**`supabase/functions/razorpay-verify-payment/index.ts`**
- Accepts: `{ order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- Verifies HMAC-SHA256 signature: `razorpay_order_id + "|" + razorpay_payment_id` signed with `RAZORPAY_KEY_SECRET`
- On success: updates order to `payment_status = 'paid_verified'`, stores payment IDs, generates tickets (using same HMAC QR logic as `create-order`)
- Returns: `{ verified: true, tickets }`

Add both to `supabase/config.toml` with `verify_jwt = false`.

---

### Part 4 — Register.tsx Updates

**Payment method state**: Change type to `'pay_at_hotel' | 'upi_qr' | 'razorpay'`

**New Razorpay option button** (between UPI QR and Pay at Hotel):
- Blue/indigo color scheme  
- Label: "Pay via Razorpay — Cards, UPI, Wallets"
- Badge: "Secure Gateway"

**Razorpay flow** (`handleRazorpayPayment`):
1. Call `handleCreateOrder()` to create the internal order (passes `payment_method: 'razorpay'`, no tickets generated)
2. Call `razorpay-create-order` edge function → get `razorpay_order_id`
3. Load Razorpay checkout script dynamically (`https://checkout.razorpay.com/v1/checkout.js`)
4. Open `new Razorpay({ key, amount, order_id, ... })` with `handler` callback
5. On handler success → call `razorpay-verify-payment` edge function
6. On verification success → `setTickets(data.tickets)` + `setStep(3)`
7. On failure/modal dismiss → show retry option, order stays `unpaid`

**Ticket step banner**: Show "✅ PAID via Razorpay — Entry Confirmed" for Razorpay payments

---

### Part 5 — Admin UI Updates

**`AdminOrders.tsx`**:
- Add `payment_method` badge display in the order list row (alongside status badge)
- Color-coded payment method chips:
  - Razorpay → blue/indigo
  - UPI QR → green
  - Pay at Hotel → orange/warning
- In expanded order detail grid, show `razorpay_payment_id` and `razorpay_order_id` if present

---

### Part 6 — Legal Pages (Create/Upgrade)

**New pages to create:**
1. `src/pages/ContactUs.tsx` → `/contact`
2. `src/pages/PricingPolicy.tsx` → `/pricing`  
3. `src/pages/ShippingPolicy.tsx` → `/shipping`

**Upgrade existing pages** (keep structure, enhance content):
4. `src/pages/PrivacyPolicy.tsx` — add section about payment gateway data processing (Razorpay)
5. `src/pages/Terms.tsx` — add Razorpay payment terms, duplicate payment handling, gateway refund section
6. `src/pages/RefundPolicy.tsx` — add gateway fee clause, failed payment / duplicate charge handling  
7. `src/pages/EventParticipationTerms.tsx` — minor refinements
8. `src/pages/DisclaimerPolicy.tsx` — minor refinements

**New page content highlights:**

*ContactUs* — Business name, address, phone, email, support hours, link to register  
*ShippingPolicy* — "No physical shipping", digital passes delivered via website, verification may delay pass release  
*PricingPolicy* — Seat pricing structure, match-specific pricing, loyalty/returning customer rates, extra seat pricing, payment options

---

### Part 7 — Footer + App.tsx Updates

**`LandingFooter.tsx`** — Add new links: Contact Us, Shipping Policy, Pricing Policy

**`App.tsx`** — Add 3 new routes: `/contact`, `/pricing`, `/shipping`

**`src/pages/admin/AdminSiteConfig.tsx`** — No changes needed, existing config keys cover all text

---

### Files Summary

| File | Action |
|---|---|
| `supabase/migrations/new.sql` | Add razorpay columns + enum value |
| `supabase/functions/razorpay-create-order/index.ts` | New edge function |
| `supabase/functions/razorpay-verify-payment/index.ts` | New edge function |
| `supabase/config.toml` | Add 2 new function entries |
| `src/pages/Register.tsx` | Add Razorpay method + flow |
| `src/pages/admin/AdminOrders.tsx` | Show payment method badge + Razorpay IDs |
| `src/pages/ContactUs.tsx` | New page |
| `src/pages/PricingPolicy.tsx` | New page |
| `src/pages/ShippingPolicy.tsx` | New page |
| `src/pages/PrivacyPolicy.tsx` | Upgrade with gateway/Razorpay section |
| `src/pages/Terms.tsx` | Upgrade with Razorpay payment terms |
| `src/pages/RefundPolicy.tsx` | Upgrade with gateway fee/duplicate payment |
| `src/components/ui/LandingFooter.tsx` | Add 3 new footer links |
| `src/App.tsx` | Add 3 new routes |

---

### Razorpay Script Loading

Razorpay checkout requires loading `https://checkout.razorpay.com/v1/checkout.js` dynamically. We'll use a utility that:
1. Checks if script already loaded
2. Injects `<script>` tag and waits for `onload`
3. Returns a Promise that resolves when `window.Razorpay` is available

No npm package needed — Razorpay standard checkout works via CDN script.

---

### Ticket Generation Logic (Updated)

`create-order` function: tickets generated when `payment_method` is `pay_at_hotel`, `cash`, or `card`.  
Razorpay tickets: generated inside `razorpay-verify-payment` function after signature verification.  
UPI QR tickets: already generated inside `verify-payment-proof` function after AI verification.

The flow is correct — no change to UPI or Pay at Hotel. Only Razorpay is added.
