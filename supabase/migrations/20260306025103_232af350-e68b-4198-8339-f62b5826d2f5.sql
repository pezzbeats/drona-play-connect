
-- ============================================================
-- Phase 2: Live Cricket Engine + Prediction Game
-- ============================================================

-- 1. ENUMS
CREATE TYPE public.match_phase_enum AS ENUM ('pre', 'innings1', 'break', 'innings2', 'ended');
CREATE TYPE public.over_status_enum AS ENUM ('pending', 'active', 'complete', 'locked');
CREATE TYPE public.extras_type_enum AS ENUM ('none', 'wide', 'no_ball', 'bye', 'leg_bye');
CREATE TYPE public.player_role_enum AS ENUM ('batsman', 'bowler', 'all_rounder', 'wicketkeeper');
CREATE TYPE public.roster_side_enum AS ENUM ('home', 'away');
CREATE TYPE public.window_type_enum AS ENUM ('ball', 'over');
CREATE TYPE public.window_status_enum AS ENUM ('open', 'locked', 'resolved');

-- 2. TEAMS
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  color TEXT,
  logo_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams readable by all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Teams writable by authenticated" ON public.teams FOR ALL USING (auth.role() = 'authenticated');

-- 3. PLAYERS
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role public.player_role_enum NOT NULL DEFAULT 'batsman',
  jersey_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players readable by all" ON public.players FOR SELECT USING (true);
CREATE POLICY "Players writable by authenticated" ON public.players FOR ALL USING (auth.role() = 'authenticated');

-- 4. MATCH ROSTER
CREATE TABLE public.match_roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  side public.roster_side_enum NOT NULL,
  is_batting_first BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, side)
);
ALTER TABLE public.match_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roster readable by all" ON public.match_roster FOR SELECT USING (true);
CREATE POLICY "Roster writable by authenticated" ON public.match_roster FOR ALL USING (auth.role() = 'authenticated');

-- 5. MATCH LIVE STATE
CREATE TABLE public.match_live_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  phase public.match_phase_enum NOT NULL DEFAULT 'pre',
  innings1_score INTEGER NOT NULL DEFAULT 0,
  innings1_wickets INTEGER NOT NULL DEFAULT 0,
  innings1_overs NUMERIC(5,1) NOT NULL DEFAULT 0,
  innings2_score INTEGER NOT NULL DEFAULT 0,
  innings2_wickets INTEGER NOT NULL DEFAULT 0,
  innings2_overs NUMERIC(5,1) NOT NULL DEFAULT 0,
  current_innings INTEGER NOT NULL DEFAULT 1,
  target_runs INTEGER,
  current_striker_id UUID REFERENCES public.players(id),
  current_non_striker_id UUID REFERENCES public.players(id),
  current_bowler_id UUID REFERENCES public.players(id),
  last_delivery_summary TEXT,
  batting_team_id UUID REFERENCES public.teams(id),
  bowling_team_id UUID REFERENCES public.teams(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.match_live_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live state readable by all" ON public.match_live_state FOR SELECT USING (true);
CREATE POLICY "Live state writable by authenticated" ON public.match_live_state FOR ALL USING (auth.role() = 'authenticated');

-- 6. OVER CONTROL
CREATE TABLE public.over_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_no INTEGER NOT NULL DEFAULT 1,
  over_no INTEGER NOT NULL,
  status public.over_status_enum NOT NULL DEFAULT 'pending',
  bowler_id UUID REFERENCES public.players(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, innings_no, over_no)
);
ALTER TABLE public.over_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Over control readable by all" ON public.over_control FOR SELECT USING (true);
CREATE POLICY "Over control writable by authenticated" ON public.over_control FOR ALL USING (auth.role() = 'authenticated');

-- 7. DELIVERIES
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  over_id UUID NOT NULL REFERENCES public.over_control(id) ON DELETE CASCADE,
  innings_no INTEGER NOT NULL DEFAULT 1,
  over_no INTEGER NOT NULL,
  ball_no INTEGER NOT NULL DEFAULT 1,
  delivery_no INTEGER NOT NULL DEFAULT 1,
  bowler_id UUID REFERENCES public.players(id),
  striker_id UUID REFERENCES public.players(id),
  non_striker_id UUID REFERENCES public.players(id),
  runs_off_bat INTEGER NOT NULL DEFAULT 0,
  extras_type public.extras_type_enum NOT NULL DEFAULT 'none',
  extras_runs INTEGER NOT NULL DEFAULT 0,
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT,
  out_player_id UUID REFERENCES public.players(id),
  fielder_id UUID REFERENCES public.players(id),
  free_hit BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deliveries readable by all" ON public.deliveries FOR SELECT USING (true);
CREATE POLICY "Deliveries writable by authenticated" ON public.deliveries FOR ALL USING (auth.role() = 'authenticated');

-- 8. PREDICTION WINDOWS
CREATE TABLE public.prediction_windows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  over_id UUID REFERENCES public.over_control(id),
  window_type public.window_type_enum NOT NULL DEFAULT 'ball',
  question TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  opens_at TIMESTAMP WITH TIME ZONE,
  locks_at TIMESTAMP WITH TIME ZONE,
  status public.window_status_enum NOT NULL DEFAULT 'open',
  correct_answer JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.prediction_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction windows readable by all" ON public.prediction_windows FOR SELECT USING (true);
CREATE POLICY "Prediction windows writable by authenticated" ON public.prediction_windows FOR ALL USING (auth.role() = 'authenticated');

-- 9. PREDICTIONS
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_id UUID NOT NULL REFERENCES public.prediction_windows(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  mobile TEXT NOT NULL,
  player_name TEXT,
  prediction JSONB NOT NULL,
  is_correct BOOLEAN,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(window_id, mobile)
);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Predictions insertable by all" ON public.predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Predictions readable by all" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Predictions updatable by authenticated" ON public.predictions FOR UPDATE USING (auth.role() = 'authenticated');

-- 10. LEADERBOARD
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  mobile TEXT NOT NULL,
  player_name TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, mobile)
);
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard readable by all" ON public.leaderboard FOR SELECT USING (true);
CREATE POLICY "Leaderboard insertable by all" ON public.leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Leaderboard updatable by authenticated" ON public.leaderboard FOR UPDATE USING (auth.role() = 'authenticated');

-- 11. FIX order_seat_pricing INSERT policy (drop broken one, add correct)
DROP POLICY IF EXISTS "Seat pricing writable by service" ON public.order_seat_pricing;
CREATE POLICY "Seat pricing insertable by all" ON public.order_seat_pricing
  FOR INSERT WITH CHECK (true);

-- 12. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_live_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.over_control;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
