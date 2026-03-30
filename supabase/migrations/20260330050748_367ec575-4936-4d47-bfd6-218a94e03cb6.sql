
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS external_match_id text UNIQUE;

CREATE TABLE IF NOT EXISTS public.api_sync_state (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  external_match_id text NOT NULL,
  last_innings1_score int DEFAULT 0,
  last_innings1_wickets int DEFAULT 0,
  last_innings1_overs numeric DEFAULT 0,
  last_innings2_score int DEFAULT 0,
  last_innings2_wickets int DEFAULT 0,
  last_innings2_overs numeric DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  sync_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync state readable by all" ON public.api_sync_state FOR SELECT USING (true);
CREATE POLICY "Sync state writable by authenticated" ON public.api_sync_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.api_sync_state;
