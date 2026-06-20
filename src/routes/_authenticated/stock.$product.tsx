import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { qtl, fmtDate } from "@/lib/format";
import { useSession, useRoles } from "@/lib/auth";
import { MasterResetDialog } from "@/components/master-reset-dialog";

export const Route = createFileRoute("/_authenticated/stock/$product")({
  component: StockHistory,
});

const LABEL: Record<string, string> = { paddy: "Paddy", rice: "Rice", bran: "Bran", broken_rice: "Broken Rice", husk: "Husk" };
const PROD_KEY: Record<string, string> = { rice: "rice_qtl", bran: "bran_qtl", broken_rice: "broken_rice_qtl", husk: "husk_qtl" };

type Mvmt = { date: string; kind: "in" | "out"; qty: number; source: string; batch_id: string | null; batch_number: string | null; actor: string | null; ref: string };

function StockHistory() {
  const { product } = Route.useParams();
  const label = LABEL[product] || product;
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user);
  const isOwner = roles.includes("owner");
  const [resetOpen, setResetOpen] = useState(false);


  const { data: inv } = useQuery({
    queryKey: ["inv-one", product],
    queryFn: async () => (await supabase.from("inventory").select("*").eq("product", product as any).maybeSingle()).data,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock-history", product],
    queryFn: async (): Promise<Mvmt[]> => {
      const out: Mvmt[] = [];

      if (product === "paddy") {
        const intakes = await supabase.from("paddy_intakes").select("created_at, intake_date, net_quantity_qtl, truck_number, paddy_batches(id, batch_number, storage_choice)");
        (intakes.data ?? []).forEach((i: any) => {
          if (i.paddy_batches?.storage_choice === "direct_production") return;
          out.push({ date: i.intake_date || i.created_at, kind: "in", qty: +i.net_quantity_qtl, source: "Intake", batch_id: i.paddy_batches?.id ?? null, batch_number: i.paddy_batches?.batch_number ?? null, actor: i.profiles?.email ?? null, ref: i.truck_number || "" });
        });
        const runs = await supabase.from("production_runs").select("created_at, run_date, paddy_used_qtl, paddy_batches(id, batch_number, storage_choice)");
        (runs.data ?? []).forEach((r: any) => {
          if (r.paddy_batches?.storage_choice === "direct_production") return;
          if (+r.paddy_used_qtl > 0) out.push({ date: r.run_date || r.created_at, kind: "out", qty: +r.paddy_used_qtl, source: "Milled", batch_id: r.paddy_batches?.id ?? null, batch_number: r.paddy_batches?.batch_number ?? null, actor: r.profiles?.email ?? null, ref: "production run" });
        });
      } else {
        const key = PROD_KEY[product];
        if (key) {
          const runs = await supabase.from("production_runs").select(`created_at, run_date, ${key}, paddy_batches(id, batch_number)`);
          (runs.data ?? []).forEach((r: any) => {
            const q = +r[key];
            if (q > 0) out.push({ date: r.run_date || r.created_at, kind: "in", qty: q, source: "Production", batch_id: r.paddy_batches?.id ?? null, batch_number: r.paddy_batches?.batch_number ?? null, actor: r.profiles?.email ?? null, ref: "milling output" });
          });
        }
      }

      const sales = await supabase.from("sales").select("id, created_at, sale_date, product, quantity_qtl, dispatch_type, batch_id, customers(name), govt_agencies(name), paddy_batches(batch_number)").eq("product", product as any);
      (sales.data ?? []).forEach((s: any) => {
        const party = s.customers?.name || s.govt_agencies?.name || String(s.dispatch_type).replace(/_/g, " ");
        out.push({ date: s.sale_date || s.created_at, kind: "out", qty: +s.quantity_qtl, source: "Sale / Dispatch", batch_id: s.batch_id, batch_number: s.paddy_batches?.batch_number ?? null, actor: s.profiles?.email ?? null, ref: party });
      });

      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return out;
    },
  });

  const sortedAsc = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  let run = 0; const running = new Map<Mvmt, number>();
  sortedAsc.forEach((r) => { run += r.kind === "in" ? r.qty : -r.qty; running.set(r, run); });

  const showHiddenReset = isOwner && product === "broken_rice";

  return (
    <div className="max-w-7xl mx-auto">
      {showHiddenReset && <MasterResetDialog open={resetOpen} onOpenChange={setResetOpen} />}
      <div className="mb-2"><Link to="/inventory" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">← INVENTORY</Link></div>
      {showHiddenReset ? (
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            {label}{" "}
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              aria-label="Master reset"
              title="Master reset (owner only)"
              className="cursor-pointer select-none align-middle hover:text-destructive transition-colors"
            >
              —
            </button>{" "}
            History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Every addition and usage for this product.</p>
        </div>
      ) : (
        <PageHeader title={`${label} — History`} description="Every addition and usage for this product." />
      )}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Current Stock</div><div className="text-2xl font-mono tabular-nums">{qtl(inv?.quantity_qtl ?? 0)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Added</div><div className="text-2xl font-mono tabular-nums text-success">{qtl(rows.filter(r=>r.kind==="in").reduce((s,r)=>s+r.qty,0))}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Used</div><div className="text-2xl font-mono tabular-nums text-destructive">{qtl(rows.filter(r=>r.kind==="out").reduce((s,r)=>s+r.qty,0))}</div></Card>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Batch</TableHead>
            <TableHead>Reference</TableHead><TableHead>By</TableHead>
            <TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">Running</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No movements yet.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fmtDate(r.date)}</TableCell>
                <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.batch_id ? <Link to="/batches/$batchId" params={{ batchId: r.batch_id }} className="text-primary hover:underline">{r.batch_number}</Link> : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px] capitalize">{r.ref || "—"}</TableCell>
                <TableCell className="text-xs font-mono">{r.actor || "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-success">{r.kind==="in"?qtl(r.qty):"—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-destructive">{r.kind==="out"?qtl(r.qty):"—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(running.get(r) ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}