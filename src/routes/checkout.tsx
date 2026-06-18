import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { 
  calculateSubtotal, 
  calculateShipping, 
  calculateTotal 
} from "@/lib/cart-calculations";
import { createRazorpayOrder } from "@/lib/razorpay.fns";

type Search = { coupon?: string; discount?: number };

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    coupon: (s.coupon as string) || undefined,
    discount: Number(s.discount) || 0,
  }),
  component: Checkout,
});

function Checkout() {
  const { coupon, discount = 0 } = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" });
  const [method, setMethod] = useState<"cod" | "razorpay" | "upi">("cod");
  const [placing, setPlacing] = useState(false);
  const [upiOrder, setUpiOrder] = useState<{ id: string; total: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!user) { nav({ to: "/login" }); return; }
    supabase.from("cart_items").select("*, products(*)").eq("user_id", user.id).then(({ data }) => setItems(data ?? []));
  }, [user, nav]);

  const subtotal = calculateSubtotal(items);
  const shipping = calculateShipping(subtotal);
  const total = calculateTotal(subtotal, discount, shipping);

  const placeOrder = async () => {
    if (!user) return;
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast.error("Please complete the address"); return;
    }
    if (items.length === 0) { toast.error("Cart is empty"); return; }
    setPlacing(true);
    
    const { data, error } = await supabase.rpc("create_order_secure", {
      p_shipping_address: form,
      p_payment_method: method,
      p_coupon_code: coupon ?? null,
    });

    if (error) { 
      toast.error(error.message); 
      setPlacing(false); 
      return; 
    }

    const result = data as any;
    if (!result || !result.success || !result.order_id) {
      toast.error("Failed to place order. Please try again.");
      setPlacing(false);
      return;
    }

    if (method === "cod") {
      nav({ to: "/order/$id", params: { id: result.order_id } });
      return;
    }

    if (method === "upi") {
      setUpiOrder({ id: result.order_id, total: total });
      setPlacing(false);
      return;
    }

    // Load Razorpay SDK
    const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!loaded) {
      toast.error("Failed to load Razorpay SDK. Please check your internet connection.");
      setPlacing(false);
      return;
    }

    try {
      const rzpOrder = await createRazorpayOrder({ data: { orderId: result.order_id } });
      
      // If we are in development fallback mode (mock order), bypass launching SDK
      if (rzpOrder.isMock) {
        toast.info("Development Mode: Simulating Razorpay payment...");
        try {
          await fetch("/api/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: result.order_id,
              payment_id: rzpOrder.id,
              payment_status: "paid",
            }),
          });
          toast.success("Mock payment successful!");
        } catch (webhookErr) {
          console.error("[Webhook Simulation] Failed:", webhookErr);
        }
        nav({ to: "/order/$id", params: { id: result.order_id } });
        return;
      }

      const options = {
        key: rzpOrder.key,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "Ayurveda Roots",
        description: "Order Payment",
        order_id: rzpOrder.id,
        handler: async function (response: any) {
          toast.success("Payment successful!");
          nav({ to: "/order/$id", params: { id: result.order_id } });
        },
        prefill: {
          name: form.full_name,
          contact: form.phone,
        },
        theme: {
          color: "#4A5D4E", // matched with ayurveda branding color
        },
        modal: {
          ondismiss: function () {
            toast.info("Payment cancelled. Order saved as pending.");
            nav({ to: "/order/$id", params: { id: result.order_id } });
          }
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to initiate payment. Order saved as pending.");
      nav({ to: "/order/$id", params: { id: result.order_id } });
    }
  };

  const confirmUpiPayment = async () => {
    if (!upiOrder) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: upiOrder.id,
          payment_id: `pay_upi_mock_${Math.random().toString(36).substring(2, 11)}`,
          payment_status: "paid",
        }),
      });
      if (!res.ok) throw new Error("Webhook failed");
      toast.success("Payment verified successfully!");
      setUpiOrder(null);
      nav({ to: "/order/$id", params: { id: upiOrder.id } });
    } catch (err) {
      toast.error("Failed to verify payment. Redirecting to order page.");
      nav({ to: "/order/$id", params: { id: upiOrder.id } });
    } finally {
      setConfirming(false);
    }
  };

  const cancelUpiPayment = (id: string) => {
    toast.info("Payment cancelled. Order saved as pending.");
    setUpiOrder(null);
    nav({ to: "/order/$id", params: { id } });
  };

  const upiLink = upiOrder
    ? `upi://pay?pa=vaidyaandco@okaxis&pn=Vaidya%20And%20Co&am=${upiOrder.total}&cu=INR&tn=Order%20${upiOrder.id.slice(0, 8)}`
    : "";
  const qrUrl = upiLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="font-display text-4xl font-semibold">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <h2 className="font-display text-xl font-semibold">Shipping address</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name" v={form.full_name} on={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
              <div className="sm:col-span-2"><Field label="Address line 1" v={form.line1} on={(v) => setForm({ ...form, line1: v })} /></div>
              <div className="sm:col-span-2"><Field label="Landmark / Apt" v={form.line2} on={(v) => setForm({ ...form, line2: v })} /></div>
              <Field label="City" v={form.city} on={(v) => setForm({ ...form, city: v })} />
              <Field label="State" v={form.state} on={(v) => setForm({ ...form, state: v })} />
              <Field label="Pincode" v={form.pincode} on={(v) => setForm({ ...form, pincode: v })} />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <h2 className="font-display text-xl font-semibold">Payment method</h2>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="mt-4 space-y-3">
              <PayOption value="cod" id="cod" title="Cash on Delivery" desc="Pay when you receive — most popular in India" checked={method==='cod'} />
              <PayOption value="razorpay" id="razorpay" title="Razorpay (Card / Netbanking)" desc="Secure online payment — coming soon" checked={method==='razorpay'} />
              <PayOption value="upi" id="upi" title="UPI" desc="Pay via PhonePe, GPay, Paytm — coming soon" checked={method==='upi'} />
            </RadioGroup>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl font-semibold">Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="text-muted-foreground">{i.products.name} × {i.quantity}</span>
                <span>{inr((i.products.discount_price ?? i.products.price) * i.quantity)}</span>
              </div>
            ))}
            <div className="my-2 border-t border-border" />
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>Coupon</span><span>− {inr(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? "FREE" : inr(shipping)}</span></div>
            <div className="my-2 border-t border-border" />
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="text-clay">{inr(total)}</span></div>
          </div>
          <Button className="mt-6 w-full rounded-full" size="lg" onClick={placeOrder} disabled={placing}>
            {placing ? "Placing…" : method === "cod" ? "Place order (COD)" : "Place order"}
          </Button>
        </aside>
      </div>

      {upiOrder && (
        <Dialog open={!!upiOrder} onOpenChange={(open) => !open && cancelUpiPayment(upiOrder.id)}>
          <DialogContent className="w-[90vw] max-w-md sm:rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <DialogHeader className="space-y-3">
              <DialogTitle className="font-display text-2xl text-center font-semibold">Scan to Pay via UPI</DialogTitle>
              <DialogDescription className="text-center text-sm text-muted-foreground">
                Scan the QR code using GPay, PhonePe, Paytm, or BHIM to pay <span className="font-semibold text-clay">{inr(upiOrder.total)}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 flex flex-col items-center justify-center w-full">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <img src={qrUrl} alt="UPI QR Code" className="size-48 object-contain" />
              </div>
              <div className="mt-4 w-full max-w-[280px] px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground font-mono truncate select-all text-center mx-auto">
                {upiLink}
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button className="w-full rounded-full" onClick={confirmUpiPayment} disabled={confirming}>
                {confirming ? "Verifying..." : "Simulate Success (Demo)"}
              </Button>
              <Button variant="outline" className="w-full rounded-full" onClick={() => cancelUpiPayment(upiOrder.id)} disabled={confirming}>
                Cancel & Pay Later
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><Input value={v} onChange={(e) => on(e.target.value)} className="mt-1" /></div>;
}

function PayOption({ value, id, title, desc, checked }: any) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
      <RadioGroupItem value={value} id={id} className="mt-1" />
      <div><div className="font-medium">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
    </label>
  );
}

