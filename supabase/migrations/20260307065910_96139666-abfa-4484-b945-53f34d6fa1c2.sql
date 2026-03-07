
-- Create match_lineup table to store per-match playing XI in batting order
CREATE TABLE public.match_lineup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  batting_order integer NOT NULL,
  is_captain boolean NOT NULL DEFAULT false,
  is_wk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, team_id, batting_order),
  UNIQUE(match_id, player_id)
);

-- Enable RLS
ALTER TABLE public.match_lineup ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Lineup readable by all" ON public.match_lineup
  FOR SELECT USING (true);

CREATE POLICY "Lineup writable by authenticated" ON public.match_lineup
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_match_lineup_match_team ON public.match_lineup(match_id, team_id);
CREATE INDEX idx_match_lineup_player ON public.match_lineup(player_id);
