import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { inr, qtl, fmtDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Boxes, Factory, Wallet, Wheat, TrendingUp, Truck, Send, IndianRupee, ArrowUpRight, ArrowDownRight, ShoppingCart } from "lucide-react";
import { OpeningBalancesWizard } from "@/components/opening-balances-wizard";
import { useSession, useRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Rice Mill Ops" }] }),
  component: Dashboard,
});

function Stat({ label, value, sub, icon: Icon, tone = "default" }: { label: string; value: string; sub?: string; icon: any; tone?: "default"|"accent"|"success" }) {
  const toneCls = tone === "accent" ? "text-accent" : tone === "success" ? "text-success" : "text-primary";
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className="mt-2 text-2xl font-bold font-mono tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatLink(props: React.ComponentProps<typeof Stat> & { to: string; params?: any }) {
  const { to, params, ...rest } = props;
  return (
    <Link to={to as any} params={params} className="block transition hover:scale-[1.01]">
      <Stat {...rest} />
    </Link>
  );
}

function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const activeRole = typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null;
  const isProcurement = activeRole === "procurement_manager";
  const isProduction = activeRole === "production_operator";
  const isSales = activeRole === "sales_executive";
  const restricted = isProcurement || isProduction || isSales;
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user);
  const isOwner = roles.includes("owner");

  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["mill-settings"], enabled: isOwner,
    queryFn: async () => (await supabase.from("mill_settings" as any).select("*").eq("id", 1).maybeSingle()).data,
  });
  useEffect(() => {
    if (isOwner && settings && (settings as any).opening_balances_set === false) setWizardOpen(true);
  }, [isOwner, settings]);

  const showFinance = !restricted;
  const showRecentTxns = !restricted;
  const showRecentPurchases = !restricted;
  const showRecentBatches = !isSales && !restricted ? true : (!isSales && !restricted);
  // Recent paddy batches: hide for sales (explicitly requested). Show for procurement/production and owner.
  const showBatchesCard = !isSales;
  // Recent sales card: show for sales and owner; hide for procurement/production was not explicitly requested, keep it.
  const showSalesCard = !restricted || isSales;
  const hideSoldInInventory = isProcurement || isProduction;

  const { data: inv } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await supabase.from("inventory").select("*")).data ?? [],
  });
  const { data: prodToday } = useQuery({
    queryKey: ["prod-today", today],
    queryFn: async () => (await supabase.from("production_runs").select("*").eq("run_date", today)).data ?? [],
  });
  const { data: cash } = useQuery({
    queryKey: ["cash-movements"], enabled: showFinance,
    queryFn: async () => (await supabase.from("cash_movements").select("*")).data ?? [],
  });
  const { data: payables } = useQuery({
    queryKey: ["payables"], enabled: showFinance,
    queryFn: async () => (await supabase.from("suppliers").select("outstanding")).data ?? [],
  });
  const { data: receivables } = useQuery({
    queryKey: ["receivables"], enabled: showFinance,
    queryFn: async () => (await supabase.from("customers").select("outstanding")).data ?? [],
  });
  const { data: recentBatches } = useQuery({
    queryKey: ["recent-batches"], enabled: showBatchesCard,
    queryFn: async () => (await supabase.from("paddy_batches").select("*").order("created_at",{ ascending: false }).limit(5)).data ?? [],
  });
  const { data: recentSales } = useQuery({
    queryKey: ["recent-sales"], enabled: showSalesCard,
    queryFn: async () => (await supabase.from("sales").select("*").order("created_at",{ ascending: false }).limit(5)).data ?? [],
  });
  const { data: recentPurchases } = useQuery({
    queryKey: ["recent-purchases"], enabled: showRecentPurchases,
    queryFn: async () => (await supabase.from("procurements").select("*, suppliers(name), paddy_batches(batch_number)").order("created_at",{ ascending: false }).limit(5)).data ?? [],
  });
  const { data: recentTxns } = useQuery({
    queryKey: ["recent-txns"], enabled: showRecentTxns,
    queryFn: async () => {
      const [c, p, e] = await Promise.all([
        supabase.from("collections").select("id, receipt_date, amount, payment_mode, customers(name)").order("created_at",{ ascending:false }).limit(8),
        supabase.from("supplier_payments").select("id, payment_date, amount, payment_mode, suppliers(name)").order("created_at",{ ascending:false }).limit(8),
        supabase.from("expenses").select("id, expense_date, amount, payment_mode, category").order("created_at",{ ascending:false }).limit(8),
      ]);
      const out: any[] = [];
      (c.data ?? []).forEach((r: any) => out.push({ id: "c"+r.id, date: r.receipt_date, kind: "in", source: "Collection", party: r.customers?.name ?? "—", mode: r.payment_mode, amount: +r.amount }));
      (p.data ?? []).forEach((r: any) => out.push({ id: "p"+r.id, date: r.payment_date, kind: "out", source: "Payment", party: r.suppliers?.name ?? "—", mode: r.payment_mode, amount: +r.amount }));
      (e.data ?? []).forEach((r: any) => out.push({ id: "e"+r.id, date: r.expense_date, kind: "out", source: "Expense", party: String(r.category).replace(/_/g," "), mode: r.payment_mode, amount: +r.amount }));
      out.sort((a,b) => a.date < b.date ? 1 : -1);
      return out.slice(0, 8);
    },
  });

  const stock = (p: string) => Number(inv?.find((i: any) => i.product === p)?.quantity_qtl ?? 0);
  const sumProd = (k: string) => (prodToday ?? []).reduce((s: number, r: any) => s + Number(r[k] ?? 0), 0);
  const paddyToday = sumProd("paddy_used_qtl");
  const riceToday = sumProd("rice_qtl");
  const recovery = paddyToday > 0 ? (riceToday / paddyToday) * 100 : 0;

  const cashIn = (cash ?? []).filter((c: any) => c.direction === "in" && (c.payment_mode === "cash")).reduce((s: number, c: any) => s + Number(c.amount), 0);
  const cashOut = (cash ?? []).filter((c: any) => c.direction === "out" && (c.payment_mode === "cash")).reduce((s: number, c: any) => s + Number(c.amount), 0);
  const bankIn = (cash ?? []).filter((c: any) => c.direction === "in" && c.payment_mode !== "cash").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const bankOut = (cash ?? []).filter((c: any) => c.direction === "out" && c.payment_mode !== "cash").reduce((s: number, c: any) => s + Number(c.amount), 0);

  const totalPayable = (payables ?? []).reduce((s: number, x: any) => s + Number(x.outstanding), 0);
  const totalReceivable = (receivables ?? []).reduce((s: number, x: any) => s + Number(x.outstanding), 0);

  return (
    <div className="max-w-7xl mx-auto">
      {isOwner && <OpeningBalancesWizard open={wizardOpen} onOpenChange={setWizardOpen} />}
      <PageHeader title="Mill Dashboard" description="Live operations snapshot" />

      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Inventory</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatLink to="/stock/$product" params={{ product: "paddy" }} label="Paddy" value={qtl(stock("paddy"))} icon={Wheat} />
        <StatLink to="/stock/$product" params={{ product: "rice" }} label="Rice" value={qtl(stock("rice"))} icon={Boxes} tone="accent" />
        <StatLink to="/stock/$product" params={{ product: "bran" }} label="Bran" value={qtl(stock("bran"))} icon={Boxes} />
        <StatLink to="/stock/$product" params={{ product: "broken_rice" }} label="Broken Rice" value={qtl(stock("broken_rice"))} icon={Boxes} />
        <StatLink to="/stock/$product" params={{ product: "husk" }} label="Husk" value={qtl(stock("husk"))} icon={Boxes} />
      </div>

      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Today's Production</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <Stat label="Paddy Processed" value={qtl(paddyToday)} icon={Factory} />
        <Stat label="Rice Produced" value={qtl(riceToday)} icon={Wheat} tone="accent" />
        <Stat label="Recovery" value={`${recovery.toFixed(2)}%`} icon={TrendingUp} tone="success" />
      </div>

      {showFinance && (
        <>
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Finance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Stat label="Cash Balance" value={inr(cashIn - cashOut)} icon={Wallet} sub={`In ${inr(cashIn)} / Out ${inr(cashOut)}`} />
            <Stat label="Bank Balance" value={inr(bankIn - bankOut)} icon={Wallet} sub={`In ${inr(bankIn)} / Out ${inr(bankOut)}`} />
            <Stat label="Receivables" value={inr(totalReceivable)} icon={IndianRupee} tone="accent" />
            <Stat label="Payables" value={inr(totalPayable)} icon={IndianRupee} />
          </div>
        </>
      )}

      {showRecentTxns && (
        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {(recentTxns ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {t.kind === "in"
                    ? <ArrowDownRight className="h-4 w-4 text-success shrink-0" />
                    : <ArrowUpRight className="h-4 w-4 text-destructive shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-medium capitalize truncate">{t.party}</div>
                    <div className="text-xs text-muted-foreground">{t.source} · <span className="uppercase font-mono">{t.mode}</span> · {fmtDate(t.date)}</div>
                  </div>
                </div>
                <div className={`font-mono tabular-nums shrink-0 ${t.kind === "in" ? "text-success" : "text-destructive"}`}>{t.kind==="in"?"+":"−"}{inr(t.amount)}</div>
              </div>
            ))}
            {(!recentTxns || recentTxns.length === 0) && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
          </div>
        </Card>
      )}

      {(showBatchesCard || showSalesCard) && (
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          {showBatchesCard && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Recent Paddy Batches</h3>
              <div className="space-y-2">
                {(recentBatches ?? []).map((b: any) => (
                  <Link key={b.id} to="/batches/$batchId" params={{ batchId: b.id }} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0 hover:bg-muted/40 rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-primary">{b.batch_number}</div>
                      <div className="truncate text-muted-foreground">{b.owner_name} · {b.variety || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums">{qtl(b.remaining_qtl)}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(b.created_at)}</div>
                    </div>
                  </Link>
                ))}
                {(!recentBatches || recentBatches.length === 0) && <p className="text-sm text-muted-foreground">No batches yet.</p>}
              </div>
            </Card>
          )}
          {showSalesCard && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Recent Sales</h3>
              <div className="space-y-2">
                {(recentSales ?? []).map((s: any) => (
                  <Link key={s.id} to="/sale/$saleId" params={{ saleId: s.id }} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0 hover:bg-muted/40 rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <div className="font-medium capitalize truncate">{s.product.replace("_"," ")} · {s.dispatch_type.replace("_"," ")}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(s.sale_date)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums">{qtl(s.quantity_qtl)}</div>
                      <div className="text-xs text-muted-foreground">{inr(s.total_amount)}</div>
                    </div>
                  </Link>
                ))}
                {(!recentSales || recentSales.length === 0) && <p className="text-sm text-muted-foreground">No sales yet.</p>}
              </div>
            </Card>
          )}
        </div>
      )}

      {showRecentPurchases && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Purchases</h3>
            <Link to="/procurement" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {(recentPurchases ?? []).map((p: any) => (
              <Link key={p.id} to="/purchase/$procId" params={{ procId: p.id }} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0 hover:bg-muted/40 rounded px-1 -mx-1">
                <div className="min-w-0 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.suppliers?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.paddy_batches?.batch_number || "—"} · {fmtDate(p.created_at)}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums">{inr(p.total_amount)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.payment_mode}</div>
                </div>
              </Link>
            ))}
            {(!recentPurchases || recentPurchases.length === 0) && <p className="text-sm text-muted-foreground">No purchases yet.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
