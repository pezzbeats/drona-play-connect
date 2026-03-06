ALTER TABLE public.semifinal_eligibility
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS notes text;