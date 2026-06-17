export interface CartItem {
  quantity: number;
  products: {
    price: number;
    discount_price: number | null;
  };
}

export interface Coupon {
  value: number;
  discount_type: string; // 'flat' | 'percent'
  min_order_value: number;
}

export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + (i.products.discount_price ?? i.products.price) * i.quantity, 0);
}

export function calculateShipping(subtotal: number): number {
  return subtotal >= 499 || subtotal === 0 ? 0 : 49;
}

export function calculateDiscount(subtotal: number, coupon: Coupon | null): number {
  if (!coupon) return 0;
  if (subtotal < coupon.min_order_value) return 0;
  
  let discount = coupon.discount_type === "flat" 
    ? coupon.value 
    : Math.round(subtotal * coupon.value / 100);

  return Math.min(discount, subtotal);
}

export function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return Math.max(0, subtotal - discount) + shipping;
}
