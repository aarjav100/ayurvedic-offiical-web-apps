import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password) {
      toast.error("Password is required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    nav({ to: "/" });
  };
  const signUp = async () => {
    if (!name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you're signed in");
    nav({ to: "/" });
  };

  return (
    <div className="mx-auto grid max-w-md px-4 py-16 md:px-8">
      <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-soft">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Leaf className="size-6" /></span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Welcome</h1>
          <p className="font-hindi text-sm text-muted-foreground">स्वागत है</p>
        </div>
        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid grid-cols-2"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList>
          <TabsContent value="signin" className="space-y-3 pt-4">
            <Field l="Email" t="email" v={email} on={setEmail} />
            <Field l="Password" t="password" v={password} on={setPassword} />
            <Button onClick={signIn} disabled={loading} className="w-full rounded-full">Sign in</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 pt-4">
            <Field l="Full name" v={name} on={setName} />
            <Field l="Email" t="email" v={email} on={setEmail} />
            <Field l="Password (min 6 chars)" t="password" v={password} on={setPassword} />
            <Button onClick={signUp} disabled={loading} className="w-full rounded-full">Create account</Button>
            <p className="text-center text-xs text-muted-foreground">By signing up you accept our terms.</p>
          </TabsContent>
        </Tabs>
        <div className="mt-6 text-center text-sm"><Link to="/" className="text-muted-foreground hover:text-primary">← Back to shop</Link></div>
      </div>
    </div>
  );
}
function Field({ l, t = "text", v, on }: { l: string; t?: string; v: string; on: (v: string) => void }) {
  return <div><Label className="text-xs text-muted-foreground">{l}</Label><Input type={t} value={v} onChange={(e) => on(e.target.value)} className="mt-1" /></div>;
}
