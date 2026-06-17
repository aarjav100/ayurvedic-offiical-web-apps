import { createAPIFileRoute } from "@tanstack/react-start/api";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createAPIFileRoute("/api/webhook")({
  POST: async ({ request }) => {
    try {
      const rawBody = await request.text();
      const headers = request.headers;
      
      const razorpaySignature = headers.get("x-razorpay-signature");
      const stripeSignature = headers.get("stripe-signature");

      let orderId: string | null = null;
      let paymentId: string | null = null;
      let paymentStatus: string = "paid";

      // 1. Verify Razorpay Webhook
      if (razorpaySignature) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
          console.warn("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured. Skipping signature validation in dev.");
        } else {
          const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");
          
          if (expectedSignature !== razorpaySignature) {
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        const payload = JSON.parse(rawBody);
        const event = payload.event;

        // We only care about payment success
        if (event === "payment.captured" || event === "order.paid") {
          const paymentEntity = payload.payload.payment?.entity;
          paymentId = paymentEntity?.id || null;
          // Try to get our internal order ID from notes
          orderId = paymentEntity?.notes?.order_id || null;
          
          // Alternative: if not in notes, search by razorpay order ID in database
          if (!orderId && paymentEntity?.order_id) {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("id")
              .eq("payment_id", paymentEntity.order_id)
              .maybeSingle();
            if (order) orderId = order.id;
          }
        } else if (event === "payment.failed") {
          const paymentEntity = payload.payload.payment?.entity;
          paymentId = paymentEntity?.id || null;
          orderId = paymentEntity?.notes?.order_id || null;
          paymentStatus = "failed";
        }
      } 
      
      // 2. Verify Stripe Webhook
      else if (stripeSignature) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
          console.warn("[Webhook] STRIPE_WEBHOOK_SECRET is not configured. Skipping signature validation in dev.");
        } else {
          // Parse stripe-signature header: t=timestamp,v1=signature
          const parts = stripeSignature.split(",");
          const timestamp = parts.find(p => p.startsWith("t="))?.substring(2);
          const signature = parts.find(p => p.startsWith("v1="))?.substring(3);

          if (!timestamp || !signature) {
            return new Response(JSON.stringify({ error: "Invalid Stripe signature header" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${timestamp}.${rawBody}`)
            .digest("hex");

          if (expectedSignature !== signature) {
            return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        const payload = JSON.parse(rawBody);
        const event = payload.type;

        if (event === "checkout.session.completed") {
          const session = payload.data.object;
          paymentId = session.payment_intent || session.id;
          orderId = session.metadata?.order_id || null;
        } else if (event === "charge.failed") {
          const charge = payload.data.object;
          paymentId = charge.id;
          orderId = charge.metadata?.order_id || null;
          paymentStatus = "failed";
        }
      }

      // If no recognized headers, check if it's a test payload in development
      else if (process.env.NODE_ENV === "development") {
        const payload = JSON.parse(rawBody);
        orderId = payload.order_id || null;
        paymentId = payload.payment_id || "test_payment_id";
        paymentStatus = payload.payment_status || "paid";
      }

      // 3. Process the order state update
      if (orderId) {
        // Fetch current order status to prevent duplicate processing (Idempotency)
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("status, payment_status")
          .eq("id", orderId)
          .maybeSingle();

        if (orderError || !order) {
          return new Response(JSON.stringify({ error: "Order not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Only update if payment is not already processed
        if (order.payment_status !== "paid" && order.payment_status !== "completed") {
          const updatedStatus = paymentStatus === "paid" ? "confirmed" : "pending";
          
          const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
              payment_status: paymentStatus,
              payment_id: paymentId,
              status: updatedStatus,
            })
            .eq("id", orderId);

          if (updateError) {
            console.error("[Webhook] Database update error:", updateError);
            return new Response(JSON.stringify({ error: "Database update failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          console.log(`[Webhook] Order ${orderId} status updated to ${updatedStatus} (${paymentStatus})`);
        } else {
          console.log(`[Webhook] Order ${orderId} already paid. Skipping update.`);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unrecognized event or missing metadata" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    } catch (err: any) {
      console.error("[Webhook] Global error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
