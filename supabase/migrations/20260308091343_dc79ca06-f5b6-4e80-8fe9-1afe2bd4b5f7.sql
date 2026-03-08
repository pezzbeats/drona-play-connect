
CREATE TABLE public.game_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile          text NOT NULL,
  match_id        uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  terms_version   text NOT NULL DEFAULT '1.0',
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  UNIQUE (mobile, match_id)
);

ALTER TABLE public.game_consents ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert their own consent
CREATE POLICY "Game consents insertable by all"
  ON public.game_consents
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated (admins) can read consents
CREATE POLICY "Game consents readable by authenticated"
  ON public.game_consents
  FOR SELECT
  USING (auth.role() = 'authenticated');
