import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageUploader } from "@/components/admin/ImageUploader";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  hindi_name: string;
  description: string;
  short_description: string;
  price: string;
  discount_price: string;
  stock: string;
  category_id: string;
  dosage_type: string;
  ingredients: string;
  benefits: string;
  usage_instructions: string;
  is_featured: boolean;
  images: string[];
};

export const emptyProduct: ProductFormValues = {
  name: "", slug: "", hindi_name: "", description: "", short_description: "",
  price: "", discount_price: "", stock: "0", category_id: "", dosage_type: "Powder",
  ingredients: "", benefits: "", usage_instructions: "", is_featured: false, images: [],
};

export function fromRow(p: any): ProductFormValues {
  return {
    id: p.id,
    name: p.name ?? "", slug: p.slug ?? "", hindi_name: p.hindi_name ?? "",
    description: p.description ?? "", short_description: p.short_description ?? "",
    price: String(p.price ?? ""), discount_price: p.discount_price ? String(p.discount_price) : "",
    stock: String(p.stock ?? "0"), category_id: p.category_id ?? "", dosage_type: p.dosage_type ?? "Powder",
    ingredients: (p.ingredients ?? []).join(", "), benefits: (p.benefits ?? []).join(", "),
    usage_instructions: p.usage_instructions ?? "", is_featured: !!p.is_featured, images: p.images ?? [],
  };
}

export function ProductForm({ initial, categories, mode }: { initial: ProductFormValues; categories: { id: string; name: string }[]; mode: "create" | "edit" }) {
  const nav = useNavigate();
  const [form, setForm] = useState<ProductFormValues>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const priceNum = Number(form.price);
    if (!form.price || isNaN(priceNum) || priceNum <= 0) { toast.error("Valid price (> 0) is required"); return; }
    
    let discountPriceNum: number | null = null;
    if (form.discount_price) {
      discountPriceNum = Number(form.discount_price);
      if (isNaN(discountPriceNum) || discountPriceNum < 0) { toast.error("Discount price must be a valid positive number"); return; }
      if (discountPriceNum >= priceNum) { toast.error("Discount price must be less than regular price"); return; }
    }
    
    const stockNum = Number(form.stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) { toast.error("Stock must be a non-negative integer"); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: (form.slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      hindi_name: form.hindi_name || null,
      description: form.description, short_description: form.short_description || null,
      price: Number(form.price), discount_price: form.discount_price ? Number(form.discount_price) : null,
      stock: Number(form.stock || 0), category_id: form.category_id || null, dosage_type: form.dosage_type,
      ingredients: form.ingredients.split(",").map((s) => s.trim()).filter(Boolean),
      benefits: form.benefits.split(",").map((s) => s.trim()).filter(Boolean),
      usage_instructions: form.usage_instructions || null, is_featured: !!form.is_featured,
      images: form.images,
    };
    const res = mode === "edit" && form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(mode === "edit" ? "Product updated" : "Product created");
    nav({ to: "/admin/products" });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <F l="Name *" v={form.name} on={(v) => set("name", v)} />
        <F l="Hindi name" v={form.hindi_name} on={(v) => set("hindi_name", v)} />
        <F l="Slug (auto from name)" v={form.slug} on={(v) => set("slug", v)} />
        <div>
          <Label>Category</Label>
          <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <F l="Price (₹) *" v={form.price} on={(v) => set("price", v)} type="number" />
        <F l="Discount price (₹)" v={form.discount_price} on={(v) => set("discount_price", v)} type="number" />
        <F l="Stock" v={form.stock} on={(v) => set("stock", v)} type="number" />
        <div>
          <Label>Form</Label>
          <Select value={form.dosage_type} onValueChange={(v) => set("dosage_type", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{["Oil","Powder","Tablet","Kadha"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2"><Label>Short description</Label><Input value={form.short_description} onChange={(e) => set("short_description", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label>Description</Label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm" /></div>
        <div className="sm:col-span-2"><Label>Ingredients (comma-separated)</Label><Input value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label>Benefits (comma-separated)</Label><Input value={form.benefits} onChange={(e) => set("benefits", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label>Usage instructions</Label><Input value={form.usage_instructions} onChange={(e) => set("usage_instructions", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2">
          <Label>Product images</Label>
          <div className="mt-2"><ImageUploader value={form.images} onChange={(images) => set("images", images)} /></div>
        </div>
        <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> Featured product</label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button variant="outline" onClick={() => nav({ to: "/admin/products" })} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create product"}</Button>
      </div>
    </div>
  );
}

function F({ l, v, on, type = "text" }: { l: string; v: string; on: (v: string) => void; type?: string }) {
  return <div><Label>{l}</Label><Input type={type} value={v} onChange={(e) => on(e.target.value)} className="mt-1" /></div>;
}
