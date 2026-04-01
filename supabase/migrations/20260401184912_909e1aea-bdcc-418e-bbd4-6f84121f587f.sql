
DROP POLICY IF EXISTS "Game access selectable" ON public.game_access;
CREATE POLICY "Game access selectable by authenticated"
  ON public.game_access
  FOR SELECT
  TO authenticated
  USING (true);
