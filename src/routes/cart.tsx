import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";
import { imageForProduct } from "@/lib/product-images";
import { toast } from "sonner";

import { 
  calculateSubtotal, 
  calculateShipping, 
  calculateDiscount, 
  calculateTotal 
} from "@/lib/cart-calculations";

export const Route = createFileRoute("/cart")({ component: Cart });

function Cart() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cart_items").select("*, products(*)").eq("user_id", user.id);
    setItems(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const updateQty = async (id: string, q: number) => {
    if (q <= 0) { await supabase.from("cart_items").delete().eq("id", id); }
    else { await supabase.from("cart_items").update({ quantity: q }).eq("id", id); }
    load();
  };
  const remove = async (id: string) => { await supabase.from("cart_items").delete().eq("id", id); load(); };

  const subtotal = calculateSubtotal(items);
  const shipping = calculateShipping(subtotal);
  const total = calculateTotal(subtotal, discount, shipping);

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase.from("coupons").select("*").eq("code", code).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Invalid coupon"); return; }
    if (subtotal < Number(data.min_order_value)) { toast.error(`Min order ₹${data.min_order_value}`); return; }
    const d = calculateDiscount(subtotal, {
      value: Number(data.value),
      discount_type: data.discount_type,
      min_order_value: Number(data.min_order_value)
    });
    setDiscount(d); setAppliedCoupon(code);
    toast.success(`Saved ${inr(d)}`);
  };

  if (authLoading) return <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">Loading…</div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center md:px-8">
      <h1 className="font-display text-3xl font-semibold">Sign in to view your jhola</h1>
      <Link to="/login" className="mt-4 inline-block"><Button className="rounded-full">Sign in</Button></Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="font-display text-4xl font-semibold">Your jhola 🛍️</h1>
      <p className="font-hindi text-muted-foreground">आपकी पसंद</p>

      {items.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-secondary/40 p-12 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Link to="/shop" className="mt-4 inline-block"><Button className="rounded-full">Browse remedies</Button></Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {items.map((i) => (
              <div key={i.id} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
                <img src={imageForProduct(i.products)} alt={i.products.name} className="size-24 rounded-xl object-cover" />
                <div className="flex-1">
                  <Link to="/product/$slug" params={{ slug: i.products.slug }} className="font-display text-lg font-semibold hover:text-primary">{i.products.name}</Link>
                  {i.products.hindi_name && <p className="font-hindi text-sm text-muted-foreground">{i.products.hindi_name}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-full border border-border">
                      <button onClick={() => updateQty(i.id, i.quantity - 1)} className="px-3 py-1">−</button>
                      <span className="w-8 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => updateQty(i.id, i.quantity + 1)} className="px-3 py-1">+</button>
                    </div>
                    <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-clay">{inr((i.products.discount_price ?? i.products.price) * i.quantity)}</div>
                  <div className="text-xs text-muted-foreground">{inr(i.products.discount_price ?? i.products.price)} each</div>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Order summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row l="Subtotal" r={inr(subtotal)} />
              {discount > 0 && <Row l={`Coupon (${appliedCoupon})`} r={`− ${inr(discount)}`} />}
              <Row l="Shipping" r={shipping === 0 ? "FREE" : inr(shipping)} />
              <div className="my-3 border-t border-border" />
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="text-clay">{inr(total)}</span></div>
            </div>
            <div className="mt-5 flex gap-2">
              <Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
              <Button variant="outline" onClick={applyCoupon}>Apply</Button>
            </div>
            <Button className="mt-5 w-full rounded-full" size="lg" onClick={() => nav({ to: "/checkout", search: { coupon: appliedCoupon ?? undefined, discount } as any })}>
              Proceed to checkout
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Free shipping on orders ₹499+ • COD available</p>
          </aside>
        </div>
      )}
    </div>
  );
}
function Row({ l, r }: { l: string; r: string }) { return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span>{r}</span></div>; }
