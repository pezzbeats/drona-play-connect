
-- 1. Extend match_phase_enum with super_over
ALTER TYPE public.match_phase_enum ADD VALUE IF NOT EXISTS 'super_over';

-- 2. Create super_over_rounds table
CREATE TABLE IF NOT EXISTS public.super_over_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  innings_a_no integer NOT NULL,
  innings_b_no integer NOT NULL,
  team_a_id uuid REFERENCES public.teams(id),
  team_b_id uuid REFERENCES public.teams(id),
  team_a_score integer NOT NULL DEFAULT 0,
  team_a_wickets integer NOT NULL DEFAULT 0,
  team_b_score integer NOT NULL DEFAULT 0,
  team_b_wickets integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','innings_a','innings_b','complete')),
  winner_team_id uuid REFERENCES public.teams(id),
  is_tied boolean NOT NULL DEFAULT false,
  activated_by_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 3. RLS for super_over_rounds
ALTER TABLE public.super_over_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super over rounds readable by all"
  ON public.super_over_rounds FOR SELECT USING (true);

CREATE POLICY "Super over rounds writable by authenticated"
  ON public.super_over_rounds FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Extend match_live_state with super over columns
ALTER TABLE public.match_live_state
  ADD COLUMN IF NOT EXISTS super_over_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS super_over_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_over_innings integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_over_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_over_wickets integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_over_overs numeric NOT NULL DEFAULT 0;

-- 5. Enable realtime for super_over_rounds
ALTER PUBLICATION supabase_realtime ADD TABLE public.super_over_rounds;
