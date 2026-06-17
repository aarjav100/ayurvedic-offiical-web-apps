-- Create secure checkout RPC
CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_shipping_address jsonb,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_cart_count int;
  v_item record;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_shipping numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_order_id uuid;
  v_order_items jsonb := '[]'::jsonb;
  v_order_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_stock int;
  v_price numeric(10,2);
  v_discount_price numeric(10,2);
  v_final_price numeric(10,2);
  v_coupon_val numeric(10,2);
  v_coupon_type text;
  v_coupon_min numeric(10,2);
  v_coupon_expires timestamptz;
  v_coupon_active boolean;
BEGIN
  -- Get user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Ensure cart has items
  SELECT COUNT(*) INTO v_cart_count FROM public.cart_items WHERE user_id = v_user_id;
  IF v_cart_count = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Lock products to prevent race conditions on stock decrement
  FOR v_item IN 
    SELECT c.product_id, c.quantity, p.name, p.price, p.discount_price, p.stock 
    FROM public.cart_items c
    JOIN public.products p ON c.product_id = p.id
    WHERE c.user_id = v_user_id
    FOR UPDATE
  LOOP
    -- Validate stock availability
    IF v_item.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product: % (Available: %, Requested: %)', 
        v_item.name, v_item.stock, v_item.quantity;
    END IF;

    -- Calculate item pricing
    v_final_price := COALESCE(v_item.discount_price, v_item.price);
    v_subtotal := v_subtotal + (v_final_price * v_item.quantity);

    -- Format order item object
    v_order_item := jsonb_build_object(
      'product_id', v_item.product_id,
      'name', v_item.name,
      'price', v_final_price,
      'quantity', v_item.quantity
    );
    v_order_items := v_order_items || v_order_item;

    -- Atomically decrement stock
    UPDATE public.products 
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- Verify coupon if provided
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT value, discount_type, min_order_value, expires_at, is_active
    INTO v_coupon_val, v_coupon_type, v_coupon_min, v_coupon_expires, v_coupon_active
    FROM public.coupons
    WHERE code = UPPER(p_coupon_code);

    IF FOUND AND v_coupon_active AND (v_coupon_expires IS NULL OR v_coupon_expires >= now()) THEN
      IF v_subtotal >= v_coupon_min THEN
        IF v_coupon_type = 'flat' THEN
          v_discount := v_coupon_val;
        ELSIF v_coupon_type = 'percent' THEN
          v_discount := ROUND((v_subtotal * v_coupon_val / 100)::numeric, 2);
        END IF;
        -- Cap discount at subtotal
        IF v_discount > v_subtotal THEN
          v_discount := v_subtotal;
        END IF;
      ELSE
        RAISE EXCEPTION 'Minimum order value of % not met for coupon %', v_coupon_min, p_coupon_code;
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid or expired coupon code: %', p_coupon_code;
    END IF;
  END IF;

  -- Calculate shipping: Free on orders >= 499, otherwise 49
  IF v_subtotal >= 499 THEN
    v_shipping := 0;
  ELSE
    v_shipping := 49;
  END IF;

  -- Calculate total
  v_total := GREATEST(0, v_subtotal - v_discount) + v_shipping;

  -- Insert order
  INSERT INTO public.orders (
    user_id,
    items,
    shipping_address,
    subtotal,
    discount,
    shipping,
    total,
    payment_method,
    payment_status,
    status,
    coupon_code
  )
  VALUES (
    v_user_id,
    v_order_items,
    p_shipping_address,
    v_subtotal,
    v_discount,
    v_shipping,
    v_total,
    p_payment_method::public.payment_method,
    'pending',
    'pending',
    UPPER(p_coupon_code)
  )
  RETURNING id INTO v_order_id;

  -- Clear cart items
  DELETE FROM public.cart_items WHERE user_id = v_user_id;

  -- Return created order details
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id
  );
END;
$$;

-- Drop user insert orders policy to prevent client-side order spoofing/bypass
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
