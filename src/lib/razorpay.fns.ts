import { createServerFn } from "@tanstack/react-start";

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data: { orderId } }) => {
    // Dynamic import keeps the .server.ts module out of the client bundle
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Fetch order details securely from database
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("total, payment_method")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      throw new Error("Order not found");
    }

    const amountInPaise = Math.round(Number(order.total) * 100);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // 2. Local development fallback if credentials are not configured
    if (!keyId || !keySecret) {
      console.warn(
        "[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Falling back to mock Razorpay order."
      );

      // Store mock razorpay_order_id in orders table
      const mockRazorpayOrderId = `order_mock_${Math.random().toString(36).substring(2, 11)}`;
      await supabaseAdmin
        .from("orders")
        .update({ payment_id: mockRazorpayOrderId })
        .eq("id", orderId);

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
    await supabaseAdmin
      .from("orders")
      .update({ payment_id: rzpOrder.id })
      .eq("id", orderId);

    return {
      isMock: false,
      key: keyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      id: rzpOrder.id,
    };
  });
