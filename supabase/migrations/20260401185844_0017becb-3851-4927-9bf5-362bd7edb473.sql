
-- =============================================
-- Phase 1: New tables + indexes + scored_at
-- =============================================

-- 1. leaderboard_match_history
CREATE TABLE public.leaderboard_match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  mobile text NOT NULL,
  player_name text,
  final_rank integer,
  final_points integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  total_predictions integer NOT NULL DEFAULT 0,
  accuracy_percentage numeric NOT NULL DEFAULT 0,
  participated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard_match_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match history readable by all"
  ON public.leaderboard_match_history FOR SELECT
  TO public USING (true);

CREATE POLICY "Match history writable by authenticated"
  ON public.leaderboard_match_history FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_lmh_match_id ON public.leaderboard_match_history(match_id);
CREATE INDEX idx_lmh_mobile ON public.leaderboard_match_history(mobile);
CREATE INDEX idx_lmh_participated ON public.leaderboard_match_history(participated_at DESC);
CREATE UNIQUE INDEX idx_lmh_match_mobile ON public.leaderboard_match_history(match_id, mobile);

-- 2. leaderboard_overall
CREATE TABLE public.leaderboard_overall (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL UNIQUE,
  player_name text,
  total_points_overall integer NOT NULL DEFAULT 0,
  correct_predictions_overall integer NOT NULL DEFAULT 0,
  total_predictions_overall integer NOT NULL DEFAULT 0,
  matches_participated integer NOT NULL DEFAULT 0,
  matches_won integer NOT NULL DEFAULT 0,
  best_match_rank integer,
  rank_position_overall integer,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard_overall ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overall leaderboard readable by all"
  ON public.leaderboard_overall FOR SELECT
  TO public USING (true);

CREATE POLICY "Overall leaderboard writable by authenticated"
  ON public.leaderboard_overall FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_lo_rank ON public.leaderboard_overall(rank_position_overall);
CREATE INDEX idx_lo_points ON public.leaderboard_overall(total_points_overall DESC);

-- Enable realtime on leaderboard_overall
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_overall;

-- 3. Add scored_at to prediction_windows for idempotent scoring
ALTER TABLE public.prediction_windows ADD COLUMN IF NOT EXISTS scored_at timestamp with time zone;

-- 4. Performance indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_leaderboard_match_rank ON public.leaderboard(match_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_leaderboard_match_points ON public.leaderboard(match_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_window_mobile ON public.predictions(window_id, mobile);
CREATE INDEX IF NOT EXISTS idx_predictions_window_correct ON public.predictions(window_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_pw_match_status ON public.prediction_windows(match_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_match_over ON public.deliveries(match_id, over_no, ball_no);
