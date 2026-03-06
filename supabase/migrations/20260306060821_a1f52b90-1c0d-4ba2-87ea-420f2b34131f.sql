CREATE TABLE IF NOT EXISTS public.gateway_secrets (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_admin_id uuid
);

ALTER TABLE public.gateway_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gateway secrets readable by authenticated"
  ON public.gateway_secrets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gateway secrets writable by authenticated"
  ON public.gateway_secrets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);