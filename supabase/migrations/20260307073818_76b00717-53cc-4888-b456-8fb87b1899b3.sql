ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_paid integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_payment_method text;