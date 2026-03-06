CREATE TABLE public.ticket_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  qr_text_hash text NOT NULL,
  ticket_id uuid,
  match_id uuid,
  scanned_by_admin_id uuid,
  outcome text NOT NULL,
  ip_address text
);

ALTER TABLE public.ticket_scan_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scan log insertable by authenticated"
  ON public.ticket_scan_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Scan log readable by authenticated"
  ON public.ticket_scan_log FOR SELECT
  TO authenticated
  USING (true);