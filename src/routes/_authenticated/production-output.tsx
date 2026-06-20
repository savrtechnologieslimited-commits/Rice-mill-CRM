import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { qtl, fmtDate, pct } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/production-output")({
  head: () => ({ meta: [{ title: "Production Output — Rice Mill Ops" }] }),
  component: Page,
});

type RunRow = {
  id: string;
  batch_id: string;
  run_date: string;
  paddy_used_qtl: number;
  rice_qtl: number;
  bran_qtl: number;
  broken_rice_qtl: number;
  husk_qtl: number;
  recovery_pct: number | null;
  paddy_batches: { batch_number: string; owner_name: string } | null;
};

function Page() {
  const qc = useQueryClient();
  const { data: runs } = useQuery({
    queryKey: ["runs-all"],
    queryFn: async () =>
      ((await supabase
        .from("production_runs")
        .select("*, paddy_batches(batch_number, owner_name)")
        .order("created_at", { ascending: false })
        .limit(50)).data ?? []) as RunRow[],
  });

  const pending = (runs ?? []).filter((r) => Number(r.rice_qtl) === 0 && Number(r.bran_qtl) === 0 && Number(r.broken_rice_qtl) === 0 && Number(r.husk_qtl) === 0);
  const completed = (runs ?? []).filter((r) => !pending.includes(r));

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Production Output" description="Record the rice, bran, broken rice, and husk produced from each milled batch. Inventory updates automatically." />

      <h3 className="font-semibold mb-3">Awaiting output ({pending.length})</h3>
      {pending.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground mb-8">No production runs awaiting output entry.</Card>
      ) : (
        <div className="space-y-4 mb-8">
          {pending.map((r) => <RunEditor key={r.id} run={r} onSaved={() => qc.invalidateQueries()} />)}
        </div>
      )}

      <h3 className="font-semibold mb-3">Recent completed runs</h3>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Batch</TableHead>
            <TableHead className="text-right">Paddy</TableHead><TableHead className="text-right">Rice</TableHead>
            <TableHead className="text-right">Bran</TableHead><TableHead className="text-right">Broken</TableHead>
            <TableHead className="text-right">Husk</TableHead><TableHead className="text-right">Recovery</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {completed.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { if (r.batch_id) window.location.assign(`/batches/${r.batch_id}`); }}>
                <TableCell className="text-xs">{fmtDate(r.run_date)}</TableCell>
                <TableCell className="text-xs">
                  {r.batch_id ? (
                    <Link to="/batches/$batchId" params={{ batchId: r.batch_id }} onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono text-primary hover:underline">{r.paddy_batches?.batch_number}</span>
                      <div className="text-muted-foreground">{r.paddy_batches?.owner_name}</div>
                    </Link>
                  ) : (<><span className="font-mono text-primary">{r.paddy_batches?.batch_number}</span><div className="text-muted-foreground">{r.paddy_batches?.owner_name}</div></>)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(r.paddy_used_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(r.rice_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(r.bran_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(r.broken_rice_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(r.husk_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.recovery_pct ? pct(+r.recovery_pct) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">Timeline <ChevronRight className="inline h-3 w-3 opacity-50"/></TableCell>
              </TableRow>
            ))}
            {completed.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6 text-sm">No completed runs.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RunEditor({ run, onSaved }: { run: RunRow; onSaved: () => void }) {
  const [f, setF] = useState({ rice: "", bran: "", broken_rice: "", husk: "" });
  const recovery = (+f.rice || 0) / (+run.paddy_used_qtl || 1) * 100;

  const save = useMutation({
    mutationFn: async () => {
      const rice = +f.rice || 0, bran = +f.bran || 0, br = +f.broken_rice || 0, husk = +f.husk || 0;
      if (rice + bran + br + husk <= 0) throw new Error("Enter at least one output quantity");
      const { error } = await supabase.from("production_runs").update({
        rice_qtl: rice, bran_qtl: bran, broken_rice_qtl: br, husk_qtl: husk,
      }).eq("id", run.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Output recorded — inventory updated"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          {run.batch_id ? (
            <Link to="/batches/$batchId" params={{ batchId: run.batch_id }} className="font-mono text-primary text-sm hover:underline">{run.paddy_batches?.batch_number}</Link>
          ) : (<div className="font-mono text-primary text-sm">{run.paddy_batches?.batch_number}</div>)}
          <div className="text-xs text-muted-foreground">{run.paddy_batches?.owner_name} · {fmtDate(run.run_date)} · Paddy used <span className="font-mono">{qtl(run.paddy_used_qtl)}</span> · {run.batch_id && <Link to="/batches/$batchId" params={{ batchId: run.batch_id }} className="text-primary hover:underline">view timeline →</Link>}</div>
        </div>
        <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">Awaiting output</Badge>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-5 gap-3 items-end">
        <div className="space-y-1"><Label className="text-xs">Rice (qtl)</Label><Input type="number" step="0.001" value={f.rice} onChange={(e) => setF({ ...f, rice: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Bran (qtl)</Label><Input type="number" step="0.001" value={f.bran} onChange={(e) => setF({ ...f, bran: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Broken (qtl)</Label><Input type="number" step="0.001" value={f.broken_rice} onChange={(e) => setF({ ...f, broken_rice: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Husk (qtl)</Label><Input type="number" step="0.001" value={f.husk} onChange={(e) => setF({ ...f, husk: e.target.value })} /></div>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : `Save (${pct(recovery)} rec)`}</Button>
      </form>
    </Card>
  );
}
