import { describe, it, expect } from "vitest";
import {
  calculateSubtotal,
  calculateShipping,
  calculateDiscount,
  calculateTotal,
  type CartItem,
} from "./cart-calculations";

describe("Cart Calculations", () => {
  describe("calculateSubtotal", () => {
    it("should calculate subtotal correctly with mixed product prices", () => {
      const items: CartItem[] = [
        { quantity: 2, products: { price: 100, discount_price: 80 } }, // 160
        { quantity: 1, products: { price: 200, discount_price: null } }, // 200
      ];
      expect(calculateSubtotal(items)).toBe(360);
    });

    it("should return 0 for an empty cart", () => {
      expect(calculateSubtotal([])).toBe(0);
    });
  });

  describe("calculateShipping", () => {
    it("should return 0 if subtotal is 0", () => {
      expect(calculateShipping(0)).toBe(0);
    });

    it("should charge 49 if subtotal is less than 499", () => {
      expect(calculateShipping(400)).toBe(49);
    });

    it("should charge 0 if subtotal is 499 or more", () => {
      expect(calculateShipping(499)).toBe(0);
      expect(calculateShipping(1000)).toBe(0);
    });
  });

  describe("calculateDiscount", () => {
    const flatCoupon = { value: 50, discount_type: "flat", min_order_value: 200 };
    const percentCoupon = { value: 10, discount_type: "percent", min_order_value: 500 };

    it("should apply flat discount if min order is met", () => {
      expect(calculateDiscount(250, flatCoupon)).toBe(50);
    });

    it("should not apply flat discount if min order is not met", () => {
      expect(calculateDiscount(150, flatCoupon)).toBe(0);
    });

    it("should apply percentage discount correctly", () => {
      expect(calculateDiscount(600, percentCoupon)).toBe(60);
    });

    it("should cap discount at subtotal", () => {
      const hugeFlatCoupon = { value: 500, discount_type: "flat", min_order_value: 100 };
      expect(calculateDiscount(200, hugeFlatCoupon)).toBe(200);
    });
  });

  describe("calculateTotal", () => {
    it("should compute final total correctly", () => {
      expect(calculateTotal(500, 50, 0)).toBe(450);
      expect(calculateTotal(300, 30, 49)).toBe(319);
    });

    it("should not allow total to be negative", () => {
      expect(calculateTotal(10, 50, 0)).toBe(0);
    });
  });
});
