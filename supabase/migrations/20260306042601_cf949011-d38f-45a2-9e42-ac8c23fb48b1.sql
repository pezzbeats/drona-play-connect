
-- ── admin_roles table ─────────────────────────────────────────────────────────
CREATE TABLE public.admin_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'operator', 'gate_staff')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles readable by authenticated"
  ON public.admin_roles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin roles writable by authenticated"
  ON public.admin_roles FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── get_admin_role SECURITY DEFINER function ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- ── rate_limit_events table ───────────────────────────────────────────────────
CREATE TABLE public.rate_limit_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rle_key_time ON public.rate_limit_events(key, created_at);
