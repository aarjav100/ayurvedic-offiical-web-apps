-- Performance Optimization: Database Indexes

-- Index on user_roles foreign key to speed up has_role queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Index on products category foreign key to speed up category listings and filters
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Index on addresses user_id foreign key to speed up profile shipping address fetches
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);

-- Index on orders user_id foreign key to speed up user order history queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Index on orders status and created_at to speed up admin filters and dashboard lists
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Index on reviews product_id to speed up reviews loading on product details page
-- Note: UNIQUE(user_id, product_id) creates a multi-column index where user_id is leading,
-- so querying by product_id alone does not leverage it efficiently.
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
