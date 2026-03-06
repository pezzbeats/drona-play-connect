
-- =============================================
-- T20 Fan Night Ops Suite — Phase 1 Schema
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'counter_staff');
CREATE TYPE match_type_enum AS ENUM ('group', 'semi_final', 'final', 'other');
CREATE TYPE match_status_enum AS ENUM ('draft', 'registrations_open', 'registrations_closed', 'live', 'ended');
CREATE TYPE prediction_mode_enum AS ENUM ('per_ball', 'per_over', 'off');
CREATE TYPE asset_type_enum AS ENUM ('banner_image', 'poster_image', 'team_flag_1', 'team_flag_2', 'terms_pdf', 'seating_map_image');
CREATE TYPE pricing_rule_type_enum AS ENUM ('standard', 'loyalty');
CREATE TYPE seating_type_enum AS ENUM ('regular', 'family');
CREATE TYPE payment_method_enum AS ENUM ('pay_at_hotel', 'upi_qr', 'cash', 'card');
CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'pending_verification', 'paid_verified', 'paid_rejected', 'paid_manual_verified');
CREATE TYPE created_source_enum AS ENUM ('self_register', 'manual_booking');
CREATE TYPE price_reason_enum AS ENUM ('loyal_base', 'new_customer', 'extra_seat', 'legacy', 'standard');
CREATE TYPE ticket_status_enum AS ENUM ('active', 'used', 'blocked');
CREATE TYPE proof_uploader_enum AS ENUM ('customer', 'admin');
CREATE TYPE ai_verdict_enum AS ENUM ('verified', 'rejected', 'needs_manual_review');
CREATE TYPE collection_method_enum AS ENUM ('cash', 'upi', 'card');

-- =============================================
-- EVENTS
-- =============================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events readable by all" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events writable by authenticated" ON public.events FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- MATCHES
-- =============================================

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  opponent TEXT,
  match_type match_type_enum NOT NULL DEFAULT 'group',
  start_time TIMESTAMPTZ,
  venue TEXT NOT NULL DEFAULT '',
  status match_status_enum NOT NULL DEFAULT 'draft',
  is_active_for_registration BOOLEAN NOT NULL DEFAULT false,
  prediction_mode prediction_mode_enum NOT NULL DEFAULT 'off',
  predictions_enabled BOOLEAN NOT NULL DEFAULT true,
  disclaimer_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: only ONE match can be active for registration at a time
CREATE UNIQUE INDEX idx_one_active_registration ON public.matches (is_active_for_registration)
  WHERE is_active_for_registration = true;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches readable by all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Matches writable by authenticated" ON public.matches FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- MATCH ASSETS
-- =============================================

CREATE TABLE public.match_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  asset_type asset_type_enum NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by_admin_id UUID
);

ALTER TABLE public.match_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match assets readable by all" ON public.match_assets FOR SELECT USING (true);
CREATE POLICY "Match assets writable by authenticated" ON public.match_assets FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- MATCH PRICING RULES
-- =============================================

CREATE TABLE public.match_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  rule_type pricing_rule_type_enum NOT NULL DEFAULT 'standard',
  base_price_new INTEGER NOT NULL,
  base_price_returning INTEGER,
  loyalty_from_match_id UUID REFERENCES public.matches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pricing rules readable by all" ON public.match_pricing_rules FOR SELECT USING (true);
CREATE POLICY "Pricing rules writable by authenticated" ON public.match_pricing_rules FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- ORDERS
-- =============================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  purchaser_full_name TEXT NOT NULL,
  purchaser_mobile TEXT NOT NULL,
  purchaser_email TEXT,
  seating_type seating_type_enum NOT NULL DEFAULT 'regular',
  seats_count INTEGER NOT NULL CHECK (seats_count > 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  pricing_model_snapshot JSONB NOT NULL DEFAULT '{}',
  payment_method payment_method_enum NOT NULL,
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
  payment_reference TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_verified_by_admin_id UUID,
  created_source created_source_enum NOT NULL DEFAULT 'self_register',
  created_by_admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, purchaser_mobile)
);

CREATE INDEX idx_orders_mobile ON public.orders(purchaser_mobile);
CREATE INDEX idx_orders_match_status ON public.orders(match_id, payment_status);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders readable by all" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Orders updatable by authenticated" ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- ORDER SEAT PRICING
-- =============================================

CREATE TABLE public.order_seat_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL,
  price_applied INTEGER NOT NULL,
  price_reason price_reason_enum NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_seat_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seat pricing readable by all" ON public.order_seat_pricing FOR SELECT USING (true);
CREATE POLICY "Seat pricing writable by all" ON public.order_seat_pricing FOR INSERT WITH CHECK (true);
CREATE POLICY "Seat pricing updatable by authenticated" ON public.order_seat_pricing FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- TICKETS
-- =============================================

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL,
  qr_text TEXT NOT NULL UNIQUE,
  status ticket_status_enum NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  checked_in_by_admin_id UUID,
  blocked_reason TEXT
);

CREATE INDEX idx_tickets_order ON public.tickets(order_id);
CREATE INDEX idx_tickets_qr ON public.tickets(qr_text);
CREATE INDEX idx_tickets_match ON public.tickets(match_id);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets readable by all" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Tickets insertable by all" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Tickets updatable by authenticated" ON public.tickets FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- PAYMENT PROOFS
-- =============================================

CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploaded_by proof_uploader_enum NOT NULL DEFAULT 'customer',
  file_path TEXT NOT NULL,
  file_sha256 TEXT NOT NULL UNIQUE,
  extracted_amount INTEGER,
  extracted_date TEXT,
  extracted_txn_id TEXT,
  extracted_vpa TEXT,
  extracted_note TEXT,
  ai_verdict ai_verdict_enum NOT NULL DEFAULT 'needs_manual_review',
  ai_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_proofs_order ON public.payment_proofs(order_id);
CREATE INDEX idx_payment_proofs_txn_id ON public.payment_proofs(extracted_txn_id);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Proofs readable by authenticated" ON public.payment_proofs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Proofs insertable by all" ON public.payment_proofs FOR INSERT WITH CHECK (true);
CREATE POLICY "Proofs updatable by authenticated" ON public.payment_proofs FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- PAYMENT COLLECTIONS (gate)
-- =============================================

CREATE TABLE public.payment_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  collected_by_admin_id UUID NOT NULL,
  method collection_method_enum NOT NULL,
  amount INTEGER NOT NULL,
  reference_no TEXT,
  proof_id UUID REFERENCES public.payment_proofs(id),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE public.payment_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collections readable by authenticated" ON public.payment_collections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Collections insertable by authenticated" ON public.payment_collections FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- ADMIN ACTIVITY (audit log)
-- =============================================

CREATE TABLE public.admin_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  meta JSONB,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity readable by authenticated" ON public.admin_activity FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Activity insertable by authenticated" ON public.admin_activity FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- GAME ACCESS (PIN after check-in)
-- =============================================

CREATE TABLE public.game_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  mobile TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pin_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_regenerated_by_admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, ticket_id)
);

CREATE INDEX idx_game_access_mobile ON public.game_access(mobile, match_id);

ALTER TABLE public.game_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game access readable by authenticated" ON public.game_access FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Game access insertable by authenticated" ON public.game_access FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Game access updatable by authenticated" ON public.game_access FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Game access public verify" ON public.game_access FOR SELECT USING (true);

-- =============================================
-- STORAGE BUCKETS
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('match-assets', 'match-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

CREATE POLICY "Match assets publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'match-assets');
CREATE POLICY "Match assets uploadable by authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'match-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Match assets deletable by authenticated" ON storage.objects FOR DELETE USING (bucket_id = 'match-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Payment proofs readable by authenticated" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');
CREATE POLICY "Payment proofs uploadable by all" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

-- =============================================
-- SEED DATA
-- =============================================

INSERT INTO public.events (id, name, venue, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'T20 Fan Night',
  'Hotel Drona Palace',
  true
);
