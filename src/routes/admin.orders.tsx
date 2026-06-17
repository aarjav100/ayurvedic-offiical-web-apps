import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OrderTimeline, type OrderStatus, type RefundStatus } from "@/components/site/OrderTimeline";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

const STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "completed", "cancelled"];
const REFUND_STATUSES: RefundStatus[] = ["not_applicable", "pending", "processing", "completed", "failed"];
const PAGE_SIZE = 8;

function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [cancelOrder, setCancelOrder] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRefund, setBulkRefund] = useState<RefundStatus | "">("");

  const load = () => {
    setLoading(true);
    // Fix 3: Exclude 'cart' sessions from the orders list
    supabase
      .from("orders")
      .select("*")
      .neq("status", "cart")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (needle) {
        const addr = o.shipping_address as any;
        const hay = `${o.id} ${addr?.full_name ?? ""} ${addr?.city ?? ""} ${addr?.pincode ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [q, statusFilter]);

  const handleStatusChange = async (order: any, status: string) => {
    if (status === "cancelled" && order.status !== "cancelled") {
      setCancelOrder(order); setReason(""); return;
    }
    setWorking(true);
    const { error } = await supabase.from("orders").update({ status: status as OrderStatus, cancellation_reason: null, cancelled_at: null }).eq("id", order.id);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Order updated to ${status}`);
    load();
  };

  const submitCancel = async () => {
    if (!cancelOrder) return;
    if (!reason.trim()) { toast.error("Cancellation reason is required"); return; }
    setWorking(true);
    const { error } = await supabase.from("orders").update({
      status: "cancelled", cancellation_reason: reason.trim(), cancelled_at: new Date().toISOString(),
    }).eq("id", cancelOrder.id);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success("Order cancelled");
    setCancelOrder(null);
    load();
  };

  const handleRefundChange = async (order: any, refund: RefundStatus) => {
    setWorking(true);
    const { error } = await supabase.from("orders").update({ refund_status: refund }).eq("id", order.id);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Refund marked as ${refund.replace("_", " ")}`);
    load();
  };

  const cancelledPageRows = pageRows.filter((o) => o.status === "cancelled");
  const allCancelledSelected = cancelledPageRows.length > 0 && cancelledPageRows.every((o) => selected.has(o.id));
  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAllOnPage = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      cancelledPageRows.forEach((o) => { if (on) next.add(o.id); else next.delete(o.id); });
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const applyBulkRefund = async () => {
    if (!bulkRefund || selected.size === 0) return;
    setWorking(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("orders").update({ refund_status: bulkRefund }).in("id", ids);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${ids.length} order(s) to ${bulkRefund.replace("_", " ")}`);
    clearSelection();
    setBulkRefund("");
    load();
  };

  const exportCSV = () => {
    const headers = ["Order ID", "Date", "Customer Name", "City", "State", "Pincode", "Total (INR)", "Payment Method", "Payment Status", "Status"];
    const rows = filtered.map(o => {
      const addr = o.shipping_address as any;
      return [
        o.id,
        new Date(o.created_at).toLocaleString(),
        `"${(addr?.full_name ?? "").replace(/"/g, '""')}"`,
        `"${(addr?.city ?? "").replace(/"/g, '""')}"`,
        `"${(addr?.state ?? "").replace(/"/g, '""')}"`,
        addr?.pincode ?? "",
        o.total,
        o.payment_method,
        o.payment_status,
        o.status
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {orders.length} orders</p>
        </div>
        <Button onClick={exportCSV} variant="outline">Export CSV</Button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order id, customer, city, pincode…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {cancelledPageRows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allCancelledSelected} onCheckedChange={(v) => toggleAllOnPage(!!v)} />
            <span className="text-muted-foreground">Select all cancelled on this page</span>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Select value={bulkRefund} onValueChange={(v) => setBulkRefund(v as RefundStatus)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Set refund status…" /></SelectTrigger>
              <SelectContent>
                {REFUND_STATUSES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyBulkRefund} disabled={working || !bulkRefund || selected.size === 0}>Apply</Button>
            <Button size="sm" variant="outline" onClick={clearSelection} disabled={selected.size === 0}>Clear</Button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && <div className="grid place-items-center rounded-2xl border border-border/60 bg-card p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
        {!loading && pageRows.length === 0 && <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-muted-foreground">No orders match your filters.</div>}
        {!loading && pageRows.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {o.status === "cancelled" && (
                  <Checkbox className="mt-1" checked={selected.has(o.id)} onCheckedChange={(v) => toggleOne(o.id, !!v)} />
                )}
                <div>
                <div className="font-mono text-sm">#{o.id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.payment_method.toUpperCase()}</div>
                <div className="mt-1 text-sm">{(o.shipping_address as any).full_name} · {(o.shipping_address as any).city}, {(o.shipping_address as any).state} — {(o.shipping_address as any).pincode}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold text-clay">{inr(o.total)}</div>
                <Select value={o.status} onValueChange={(v) => handleStatusChange(o, v)} disabled={working}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{(o.items as any[]).map((i) => `${i.name} × ${i.quantity}`).join(", ")}</div>
            <div className="mt-5 border-t border-border/60 pt-5">
              <OrderTimeline
                status={o.status as OrderStatus}
                createdAt={o.created_at}
                cancelledAt={o.cancelled_at}
                cancellationReason={o.cancellation_reason}
                paymentMethod={o.payment_method}
                refundStatus={o.refund_status}
                refundUpdatedAt={o.refund_updated_at}
              />
              {o.status === "cancelled" && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Refund / credit status</Label>
                  <Select value={o.refund_status ?? "not_applicable"} onValueChange={(v) => handleRefundChange(o, v as RefundStatus)} disabled={working}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REFUND_STATUSES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {o.refund_updated_at && <span className="text-xs text-muted-foreground">Updated {new Date(o.refund_updated_at).toLocaleString()}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm">
          <div className="text-muted-foreground">Page {pageSafe} of {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={!!cancelOrder} onOpenChange={(v) => !v && setCancelOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order #{cancelOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Cancellation reason</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="e.g. Out of stock, customer requested cancellation…"
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">The customer will see this reason and an estimated refund date.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)} disabled={working}>Back</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={working}>{working ? "Cancelling…" : "Confirm cancel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
