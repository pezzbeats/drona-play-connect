
-- Add audit/fraud columns to payment_proofs
ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS overridden_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS ai_confidence text CHECK (ai_confidence IN ('high', 'medium', 'low', 'none')),
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb;
