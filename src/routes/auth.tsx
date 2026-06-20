import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wheat, Truck, ShoppingCart, Factory, Send, IndianRupee, Shield, ArrowLeft } from "lucide-react";
import { ROLE_LABELS, ROLE_HOME, ROLE_TAGLINE, type AppRole } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Rice Mill Operations" }] }),
  component: AuthPage,
});

const ROLE_ICONS: Record<AppRole, any> = {
  owner: Shield,
  procurement_manager: Truck,
  production_operator: Factory,
  sales_executive: Send,
  accounts: IndianRupee,
};

const PICKABLE: AppRole[] = ["owner","procurement_manager","production_operator","sales_executive","accounts"];

async function routeAfterLogin(navigate: ReturnType<typeof useNavigate>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const has = (roles ?? []).map((r: any) => r.role as AppRole);
  const stored = (typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null) as AppRole | null;
  if (stored && (has.includes(stored) || has.includes("owner"))) {
    return navigate({ to: ROLE_HOME[stored] as any });
  }
  if (has.includes("owner")) return navigate({ to: "/dashboard" });
  const first = has[0];
  navigate({ to: (first ? ROLE_HOME[first] : "/dashboard") as any });
}

function AuthPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const toEmail = (u: string) => (u.includes("@") ? u.trim() : `${u.trim().toLowerCase()}@mill.local`);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeAfterLogin(navigate);
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
    if (error) { setLoading(false); return toast.error(error.message); }
    const { data: rr } = await supabase.from("user_roles").select("role").eq("user_id", data.user!.id);
    const has = (rr ?? []).map((r: any) => r.role as AppRole);
    setLoading(false);
    if (role !== "owner" && !has.includes(role) && !has.includes("owner")) {
      await supabase.auth.signOut();
      return toast.error(`You don't have the ${ROLE_LABELS[role]} role. Ask the Owner.`);
    }
    if (role === "owner" && !has.includes("owner")) {
      await supabase.auth.signOut();
      return toast.error("This account is not an Owner.");
    }
    sessionStorage.setItem("mill.activeRole", role);
    navigate({ to: (role === "owner" ? "/dashboard" : ROLE_HOME[role]) as any });
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border px-6 py-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Wheat className="h-4 w-4" /></div>
          <div>
            <div className="font-semibold">Rice Mill Operations</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">CHOOSE YOUR ROLE TO SIGN IN</div>
          </div>
        </header>
        <main className="flex-1 px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Who's signing in?</h1>
            <p className="text-muted-foreground mb-8">Pick your role. Each role opens its own workspace — every entry flows into the same live mill data.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PICKABLE.map((r) => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button key={r} onClick={() => setRole(r)} className="text-left group">
                    <Card className="p-5 h-full transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5">
                      <div className="flex items-start gap-3">
                        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${r === "owner" ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"} group-hover:bg-primary group-hover:text-primary-foreground transition-colors`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">{ROLE_LABELS[r]}</div>
                          <div className="text-xs text-muted-foreground mt-1">{ROLE_TAGLINE[r]}</div>
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-8 font-mono">ACCOUNTS ARE CREATED BY THE OWNER · NO SELF-SIGNUP</p>
          </div>
        </main>
      </div>
    );
  }

  const Icon = ROLE_ICONS[role];
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground"><Wheat className="h-5 w-5" /></div>
          <span className="font-semibold text-lg">Rice Mill Ops</span>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sidebar-accent/20 px-3 py-1 text-xs font-mono uppercase tracking-wider mb-6"><Icon className="h-3 w-3"/>{ROLE_LABELS[role]} WORKSPACE</div>
          <h1 className="text-4xl font-bold leading-tight">Sign in to your <span className="text-accent">{ROLE_LABELS[role].toLowerCase()}</span> workspace.</h1>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">{ROLE_TAGLINE[role]}</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50 font-mono">PADDY → PRODUCTION → RICE → SALES → PAYMENTS</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => setRole(null)} className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6"><ArrowLeft className="h-3 w-3"/>Pick a different role</button>
          <div className="flex items-center gap-3 mb-6">
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${role === "owner" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold">{ROLE_LABELS[role]}</div>
              <div className="text-xs text-muted-foreground">{ROLE_TAGLINE[role]}</div>
            </div>
          </div>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2"><Label>Username</Label><Input type="text" autoCapitalize="none" autoCorrect="off" placeholder="e.g. abhishek123" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in..." : `Sign in as ${ROLE_LABELS[role]}`}</Button>
            <p className="text-xs text-muted-foreground">Don't have an account? Ask the Owner to create one for you.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
