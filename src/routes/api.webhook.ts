import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { order_id, payment_id, payment_status } = body as {
            order_id: string;
            payment_id?: string;
            payment_status?: string;
          };

          if (!order_id) {
            return new Response(JSON.stringify({ error: "Missing order_id" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 1. Update order in database using bypass-RLS admin client
          const { error } = await supabaseAdmin
            .from("orders")
            .update({
              payment_id: payment_id || null,
              payment_status: payment_status || "paid",
              status: payment_status === "paid" ? "confirmed" : "pending",
            })
            .eq("id", order_id);

          if (error) {
            console.error("[Webhook] Database update failed:", error);
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Webhook] Server error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
