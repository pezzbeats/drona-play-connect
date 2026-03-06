-- Add razorpay enum value
ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'razorpay';

-- Add Razorpay columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS gateway_response jsonb;