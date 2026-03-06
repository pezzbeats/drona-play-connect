
-- 1. match_flags table for panic controls
CREATE TABLE public.match_flags (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  predictions_frozen boolean NOT NULL DEFAULT false,
  scanning_frozen boolean NOT NULL DEFAULT false,
  windows_locked boolean NOT NULL DEFAULT false,
  frozen_by_admin_id uuid,
  frozen_at timestamptz,
  freeze_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match flags readable by all"
  ON public.match_flags FOR SELECT USING (true);

CREATE POLICY "Match flags writable by authenticated"
  ON public.match_flags FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Partial unique index: only one active over per innings per match
CREATE UNIQUE INDEX IF NOT EXISTS over_control_one_active_per_innings
  ON public.over_control (match_id, innings_no)
  WHERE status = 'active';

-- 3. Partial unique index: only one open prediction window per match
CREATE UNIQUE INDEX IF NOT EXISTS prediction_windows_one_open_per_match
  ON public.prediction_windows (match_id)
  WHERE status = 'open';

-- 4. Enable realtime for match_flags
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_flags;
