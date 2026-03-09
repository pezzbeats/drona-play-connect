
-- Create coupons table for victory coupon persistence and redemption tracking
CREATE TABLE public.coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,
  customer_name         text NOT NULL,
  customer_mobile       text NOT NULL,
  discount_text         text NOT NULL,
  expiry_date           date,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'redeemed', 'expired')),
  redeemed_at           timestamptz,
  redeemed_by_admin_id  uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Only authenticated (admin) users can read coupons
CREATE POLICY "Coupons readable by authenticated"
  ON public.coupons
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only authenticated (admin) users can insert coupons
CREATE POLICY "Coupons insertable by authenticated"
  ON public.coupons
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated (admin) users can update coupons (for redemption)
CREATE POLICY "Coupons updatable by authenticated"
  ON public.coupons
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Index for fast code lookups during scanning
CREATE INDEX idx_coupons_code ON public.coupons (code);

-- Index for filtering by status
CREATE INDEX idx_coupons_status ON public.coupons (status);

-- Index for mobile lookups
CREATE INDEX idx_coupons_mobile ON public.coupons (customer_mobile);
