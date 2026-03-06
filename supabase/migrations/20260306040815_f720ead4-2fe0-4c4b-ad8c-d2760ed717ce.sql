
-- Create match_scoring_config table
CREATE TABLE public.match_scoring_config (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  points_per_correct int NOT NULL DEFAULT 10,
  points_per_over_correct int NOT NULL DEFAULT 25,
  speed_bonus_enabled boolean NOT NULL DEFAULT false,
  speed_bonus_points int NOT NULL DEFAULT 5,
  speed_bonus_first_n int NOT NULL DEFAULT 10,
  tiebreaker_mode text NOT NULL DEFAULT 'accuracy',
  leaderboard_frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoring config readable by all"
  ON public.match_scoring_config FOR SELECT USING (true);

CREATE POLICY "Scoring config writable by authenticated"
  ON public.match_scoring_config FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Extend leaderboard table
ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS tiebreaker_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_adjustment int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS last_correct_at timestamptz,
  ADD COLUMN IF NOT EXISTS rank_position int;

-- Index for fast rank ordering
CREATE INDEX IF NOT EXISTS idx_leaderboard_match_rank
  ON public.leaderboard(match_id, rank_position ASC NULLS LAST);
