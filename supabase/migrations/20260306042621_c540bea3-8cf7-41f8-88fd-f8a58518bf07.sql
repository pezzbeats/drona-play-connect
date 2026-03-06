
-- Fix: enable RLS on rate_limit_events (only accessed via service_role in edge functions)
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed — edge functions use service_role key which bypasses RLS
-- But we need at least a restrictive policy so PostgREST blocks anon/authenticated direct access
CREATE POLICY "Rate limit events: no direct access"
  ON public.rate_limit_events FOR ALL
  USING (false)
  WITH CHECK (false);
