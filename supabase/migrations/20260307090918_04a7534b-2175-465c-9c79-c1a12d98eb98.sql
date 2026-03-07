
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_type   text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_value  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0;
