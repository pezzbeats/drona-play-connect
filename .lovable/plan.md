
## What's Already Working

After a thorough review, the Razorpay integration is largely in place:
- Order creation, checkout popup, backend signature verification, and automatic ticket generation all exist in the current code
- Gateway secrets management, admin reconciliation page, and CSV export are all built

## What's Actually Missing

The prompt highlights 3 genuine gaps that need to be built:

---

### 1. Razorpay Webhook Handler (Critical for reliability)
A new edge function `razorpay-webhook` that handles the case where a user closes the browser after Razorpay processes payment but before the frontend receives the callback.

- Receives Razorpay webhook POST to `/functions/v1/razorpay-webhook`
- Verifies `X-Razorpay-Signature` header (HMAC-SHA256 of raw body using webhook secret)
- Handles `payment.captured` event only
- Looks up the order by `razorpay_order_id` from the payment notes
- **Idempotent**: checks if tickets already exist before generating — skips if already done
- Updates order to `paid_verified` if not already
- Returns 200 immediately (Razorpay requires a fast response)

The webhook secret will be stored in the existing `gateway_secrets` table under key `razorpay_webhook_secret`. The admin can enter it in the Gateway Settings tab on `/admin/payments`.

---

### 2. Fix Duplicate Ticket Risk in `razorpay-verify-payment`
Currently the edge function blindly inserts tickets every time it's called. If the frontend calls it twice (e.g. on retry), duplicate tickets are created.

- Add a check: query `tickets` where `order_id = order.id` — if tickets already exist, skip generation and return existing tickets instead
- Also guard against re-verifying an already `paid_verified` order

---

### 3. Payment Retry Flow in Register.tsx
When the Razorpay modal is dismissed (`ondismiss`), the internal order is already created but the user sees a dead end. They need to retry.

- Add `razorpayOrderId` state to track the Razorpay order ID once created
- On `ondismiss`: set `razorpayLoading = false` but keep `orderId` and `razorpayOrderId` in state
- Show a "Retry Payment" button in the payment step if `orderId` is set and `paymentMethod === 'razorpay'`
- The retry skips order creation and goes directly to opening the Razorpay checkout with the existing Razorpay order ID

---

### Files to Create/Edit

| File | Change |
|---|---|
| `supabase/functions/razorpay-webhook/index.ts` | **New** — webhook handler with idempotent ticket generation |
| `supabase/functions/razorpay-verify-payment/index.ts` | **Fix** — idempotency check before ticket generation |
| `src/pages/Register.tsx` | **Fix** — retry payment flow after modal dismiss |
| `src/pages/admin/AdminPayments.tsx` | **Add** — `razorpay_webhook_secret` field in Gateway Settings tab |
| `supabase/config.toml` | **Add** — `[functions.razorpay-webhook]` entry |

---

### Webhook Registration Note
The webhook URL to register in the Razorpay dashboard will be:
```
https://fkblggtrpyubuglndotz.supabase.co/functions/v1/razorpay-webhook
```
Events to subscribe: `payment.captured`

The Gateway Settings tab in `/admin/payments` will include a third field for the webhook secret alongside Key ID and Key Secret.
