import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data: { orderId }, context }) => {
    // 1. Fetch order details securely from database using user session
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("total, payment_method")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      console.error("[Razorpay] Failed to fetch order from database:", error);
      throw new Error("Order not found");
    }

    const amountInPaise = Math.round(Number(order.total) * 100);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Dynamic import keeps the .server.ts module out of the client bundle
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 2. Local development fallback if credentials are not configured
    if (!keyId || !keySecret) {
      console.warn(
        "[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Falling back to mock Razorpay order."
      );

      // Store mock razorpay_order_id in orders table
      const mockRazorpayOrderId = `order_mock_${Math.random().toString(36).substring(2, 11)}`;
      try {
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ payment_id: mockRazorpayOrderId })
          .eq("id", orderId);
        if (updateError) {
          throw updateError;
        }
      } catch (err) {
        console.warn(
          "[Razorpay] Failed to save mock payment_id to DB (likely missing service role key):",
          err
        );
      }

      return {
        isMock: true,
        key: "rzp_test_mockkey",
        amount: amountInPaise,
        currency: "INR",
        id: mockRazorpayOrderId,
      };
    }

    // 3. Make real API request to Razorpay
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: orderId,
        notes: {
          order_id: orderId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Razorpay] Order creation failed:", errorText);
      throw new Error("Razorpay integration error");
    }

    const rzpOrder = await response.json();

    // 4. Save Razorpay Order ID to database payment_id column
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_id: rzpOrder.id })
      .eq("id", orderId);

    if (updateError) {
      console.error("[Razorpay] Failed to save payment_id to database:", updateError);
      throw new Error("Database update error");
    }

    return {
      isMock: false,
      key: keyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      id: rzpOrder.id,
    };
  });

