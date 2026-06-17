
-- 1. Product Status
DO $$ BEGIN
    CREATE TYPE public.product_status AS ENUM ('active', 'inactive', 'out_of_stock');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'active';

-- 2. Update Order Status Enum
-- Note: ALTER TYPE ADD VALUE cannot be executed in a transaction block in some Postgres versions,
-- but Supabase migrations handle it.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cart';

-- 3. Add order_placed flag to orders (Fix 4)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_placed BOOLEAN NOT NULL DEFAULT true;
