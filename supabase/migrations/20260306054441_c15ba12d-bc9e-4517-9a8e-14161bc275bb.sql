
-- Create site_config table
CREATE TABLE public.site_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Config readable by all" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "Config writable by authenticated" ON public.site_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
