import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Package, ShoppingBag, IndianRupee, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("products").select("id, stock, status").then(({ data }) => setProducts(data ?? []));
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setOrders(data ?? []));
  }, []);

  const stats = useMemo(() => ({
    // Fix 2: Revenue should only count completed/confirmed/delivered orders
    revenue: orders
      .filter((o) => ["completed", "delivered", "confirmed"].includes(o.status))
      .reduce((s, o) => s + Number(o.total), 0),
    // Fix 3: Orders count should exclude cart sessions
    orderCount: orders.filter((o) => o.status !== "cart").length,
    // Fix 1: Products count showing all 'active' products
    productCount: products.filter((p) => p.status === "active").length,
    // Fix 4: Pending orders logic
    pending: orders.filter((o) => o.status === "pending" && o.order_placed === true).length,
    lowStock: products.filter((p) => p.stock < 10).length,
  }), [orders, products]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Overview of your store</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={IndianRupee} label="Revenue" value={inr(stats.revenue)} />
        <Stat icon={ShoppingBag} label="Orders" value={String(stats.orderCount)} />
        <Stat icon={Package} label="Products" value={String(stats.productCount)} hint={`${stats.lowStock} low stock`} />
        <Stat icon={Clock} label="Pending orders" value={String(stats.pending)} />
      </div>

      <div className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {orders.slice(0, 5).length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-2">Order</th><th className="pb-2">Date</th><th className="pb-2">Status</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="py-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="py-2 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-2 capitalize">{o.status}</td>
                    <td className="py-2 text-right font-medium">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-1 font-display text-3xl font-semibold text-clay">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
