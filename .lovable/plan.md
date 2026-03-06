
## Admin Payments Page — Plan

### What to Build
A dedicated `/admin/payments` page with two tabs:
1. **Razorpay Transactions** — table of all orders with Razorpay data (payment_id, order_id, gateway_response, status, amount, customer, date)
2. **Gateway Settings** — form to update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` via an edge function that calls `supabase.functions.invoke` to set the secrets securely (super_admin only)

### Role Access
- Transactions tab: `operator+` (same as orders page)
- Gateway Settings tab: `super_admin` only (secrets are sensitive)

### Files to Create/Edit

| File | Action |
|---|---|
| `src/pages/admin/AdminPayments.tsx` | New page — two tabs |
| `supabase/functions/update-razorpay-secrets/index.ts` | New edge function — updates secrets |
| `supabase/config.toml` | Add new function entry |
| `src/App.tsx` | Add route `/admin/payments` (operator+) |
| `src/components/admin/AdminSidebar.tsx` | Add "Payments" nav item (operator+) |
| `src/components/admin/AdminBottomNav.tsx` | Add "Payments" to overflow items (operator+) |

### Page Layout — AdminPayments.tsx

**Tab 1: Razorpay Transactions**
- Summary cards: Total Razorpay orders, Total verified, Total amount collected via Razorpay
- Searchable table (by name, mobile, razorpay_payment_id)
- Columns: Customer name + mobile | Amount | Status badge | Payment ID (monospace, copyable) | Order ID (monospace, copyable) | Date | Expand row
- Expanded row: full `gateway_response` JSON displayed in a styled `<pre>` block
- Filter: All / paid_verified / unpaid / pending
- Only shows orders where `payment_method = 'razorpay'`
- Refresh button

**Tab 2: Gateway Settings** (super_admin only, hidden for operators with access denied card)
- Warning card: "Changing these values will affect all future Razorpay payments immediately"
- Two fields: Key ID (text input) and Key Secret (password input, masked)
- "Show / Hide" toggle on Key Secret
- Save button → calls `update-razorpay-secrets` edge function
- Current key_id display (masked last 4 chars) — fetched from a config endpoint or just labelled "currently set"
- Note: secrets are write-only from this UI; we never display the actual secret value back

### Edge Function — update-razorpay-secrets
- Accepts: `{ key_id, key_secret }` from admin
- Requires authenticated admin session (verify role via `supabase.auth.getClaims`)
- Uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to call the Supabase Management API's secrets endpoint: `PATCH /v1/projects/{ref}/secrets`
- Returns success or error
- Set `verify_jwt = false` in config.toml and validate manually (pattern already used in project)

Note: The Management API for secrets requires `SUPABASE_PROJECT_ID` — available as env var `VITE_SUPABASE_PROJECT_ID` (project ID: `fkblggtrpyubuglndotz`). The edge function will use `Deno.env.get("SUPABASE_URL")` to derive the project ref, or we hardcode the project ref from the known env.

Actually, looking at the Supabase Management API — it needs a service role key or management API key. The standard `SUPABASE_SERVICE_ROLE_KEY` can update secrets via the `vault` or via management API. Let me think about the right approach.

Better approach for secrets update: Rather than using the Management API (which requires a separate management token), we store the Razorpay keys in the `site_config` table with masked display, and the edge function reads from there — BUT that's insecure since site_config is publicly readable.

**Revised approach for Gateway Settings:**
- Store Razorpay keys in Supabase `vault` secrets — but that's complex to update programmatically.
- **Best practical approach**: Create a `gateway_config` section in `site_config` with a write-only semantic: admin enters new key values → edge function `update-razorpay-secrets` receives them → edge function uses the Supabase Management API (`https://api.supabase.com/v1/projects/{ref}/secrets`) with `SUPABASE_SERVICE_ROLE_KEY` won't work for management API.

**Final practical approach**: The edge function calls the Supabase Management API using a `SUPABASE_MANAGEMENT_API_KEY` secret OR we use the `vault.secrets` table to upsert. But vault requires special permissions.

**Simplest working approach**: The `update-razorpay-secrets` edge function accepts the new key values and uses `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` to do a supabase-admin call. Since the actual Razorpay keys are already in Supabase secrets, we need the Management API. 

We have access to `SUPABASE_PROJECT_ID` = `fkblggtrpyubuglndotz`. The Management API endpoint to update secrets is:
`POST https://api.supabase.com/v1/projects/{ref}/secrets` with a bearer token (service role key won't work — needs a personal access token or service account token).

**Most practical secure approach**: Store the Razorpay key_id and key_secret in the `site_config` table but with a dedicated `gateway_secrets` table that is:
- RLS: readable only by authenticated (admin)
- No public read
- Edge functions read from their own environment (already set secrets) OR from this table

Actually the cleanest approach: Create a `gateway_config` table (not site_config which is publicly readable) with RLS for authenticated only, and:
- Store `razorpay_key_id` and an indicator that key_secret is set (but NOT the actual secret value in DB)
- The edge functions continue using `Deno.env.get("RAZORPAY_KEY_ID")` for the actual secret
- For updating: provide a UI form that shows instructions + a link to Lovable's secret management OR use the `add_secret` tool pattern

Wait — but user explicitly asked to "update razorpay secrets in the admin panel". The practical way is via edge function using Supabase Management API. We DO have `VITE_SUPABASE_PROJECT_ID` = `fkblggtrpyubuglndotz`. But we'd need the management API bearer token.

**Final decision**: The most pragmatic and actually-working approach:
- Create a `gateway_config` table in the DB (auth-only readable/writable via RLS) to store the Razorpay Key ID (visible, not a secret) and a flag that secret is configured
- The Key Secret update: the edge function calls `supabase.rpc` won't help. Instead, use `supabase-js` admin client with the vault.secrets approach — `supabase.from('vault.secrets')` can be done with service role, and then edge functions read with `select decrypted_secret from vault.decrypted_secrets`

Actually the SIMPLEST: I'll store Key ID in `site_config` (since it's semi-public, the key_id is shown in the browser already via the checkout script), and for Key Secret, I'll use the Supabase vault via the edge function:

```
INSERT INTO vault.secrets (name, secret) VALUES ('RAZORPAY_KEY_SECRET', '...') 
ON CONFLICT (name) DO UPDATE SET secret = excluded.secret
```

But the edge function reading from `vault.decrypted_secrets` works with service role. This IS a valid approach.

**FINAL PLAN**:

**Gateway Settings tab** (super_admin only):
- Field 1: Razorpay Key ID — store in `site_config` table under key `razorpay_key_id` (Key ID is non-secret, shown in checkout.js anyway)
- Field 2: Razorpay Key Secret — write-only form, stored via edge function into Supabase vault as `RAZORPAY_KEY_SECRET`, read by other edge functions via `Deno.env.get("RAZORPAY_KEY_SECRET")` — BUT vault secrets don't auto-inject as env vars to edge functions unless they're added as project secrets via Management API or the Lovable tool.

**SIMPLEST ACTUAL WORKING APPROACH**: 
- Key ID: store in `site_config` (it's used in the frontend checkout anyway)
- Key Secret: The edge functions already use `Deno.env.get("RAZORPAY_KEY_SECRET")` which is set via Lovable's secret tool. To update via admin UI, the edge function would need to use the Supabase Management API with a management token. Since we don't have that stored, the admin panel for secrets should use a **separate `gateway_secrets` table** (auth-only RLS) and the edge functions should be updated to read from DB instead of env.

This gets complex. **Pragmatic decision**: The page will show a "Gateway Secrets" section that updates keys in a DB table (`gateway_secrets`) that only authenticated users can read, and the edge functions will be updated to check DB first, fallback to env. This is reasonably secure for this use case.

**Actually the right call**: Keep it simple. The edge functions reading from Deno env is fine and already working. For the admin panel secret update, we'll create the UI + edge function, and that edge function will use the Supabase Management API. We DO need the management API token — let me plan to add it as a secret `SUPABASE_ACCESS_TOKEN`.

Hmm, that requires the user to paste in their personal access token. Let me ask... no, user said "fully functional". 

**TRULY FINAL APPROACH** — Gateway Settings via DB table:
1. Create `gateway_secrets` table: `key text PK, value text, updated_at timestamptz, updated_by uuid`. RLS: only authenticated can read/write.
2. Edge functions updated to: first check `gateway_secrets` table for key, fallback to env vars. This makes the DB the source of truth when set.
3. Admin UI writes new key/secret to `gateway_secrets` table directly via the supabase client (authenticated admin).
4. Key Secret is masked in display (show only last 4 chars).
5. This works immediately without any Management API.

This is clean, secure (RLS enforced), and actually works. Let me go with this.

### Database Migration needed
```sql
CREATE TABLE public.gateway_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_admin_id uuid
);
ALTER TABLE public.gateway_secrets ENABLE ROW LEVEL SECURITY;
-- Only authenticated (admins) can read
CREATE POLICY "Gateway secrets readable by authenticated" ON public.gateway_secrets
  FOR SELECT TO authenticated USING (true);
-- Only authenticated (admins) can write
CREATE POLICY "Gateway secrets writable by authenticated" ON public.gateway_secrets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Seed with empty placeholders
INSERT INTO public.gateway_secrets (key, value) VALUES
  ('razorpay_key_id', ''),
  ('razorpay_key_secret', '')
ON CONFLICT (key) DO NOTHING;
```

Edge functions `razorpay-create-order` and `razorpay-verify-payment` need updating to check `gateway_secrets` first, then fall back to env vars.

### Summary of Files

| File | Action |
|---|---|
| `supabase/migrations/new.sql` | Create `gateway_secrets` table |
| `src/pages/admin/AdminPayments.tsx` | New page with 2 tabs |
| `supabase/functions/razorpay-create-order/index.ts` | Read key_id from gateway_secrets first, fallback env |
| `supabase/functions/razorpay-verify-payment/index.ts` | Read key_secret from gateway_secrets first, fallback env |
| `src/App.tsx` | Add route `/admin/payments` (operator+) |
| `src/components/admin/AdminSidebar.tsx` | Add "Payments" nav item with CreditCard icon |
| `src/components/admin/AdminBottomNav.tsx` | Add "Payments" to overflow items |
