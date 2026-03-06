CREATE TABLE public.semifinal_eligibility (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile text NOT NULL UNIQUE,
  uploaded_by uuid NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  match_label text NULL DEFAULT 'Semi Final'
);

ALTER TABLE public.semifinal_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eligibility readable by all"
  ON public.semifinal_eligibility FOR SELECT USING (true);

CREATE POLICY "Eligibility writable by authenticated"
  ON public.semifinal_eligibility FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
