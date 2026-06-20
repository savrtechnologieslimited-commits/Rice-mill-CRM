import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { qtl, fmtDate } from "@/lib/format";
import { DryingPanel } from "@/components/drying-panel";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [{ title: "Production Run — Rice Mill Ops" }] }),
  component: Production,
});

function Production() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    run_date: new Date().toISOString().slice(0,10),
    batch_id: "",
    paddy_used: "",
    notes: "",
  });

  const { data: batches } = useQuery({
    queryKey: ["batches-runnable"],
    queryFn: async () => (await supabase.from("paddy_batches").select("*").in("status",["available","drying","in_production"]).gt("remaining_qtl",0).order("created_at",{ascending:false})).data ?? [],
  });
  const { data: runs } = useQuery({
    queryKey: ["recent-runs"],
    queryFn: async () => (await supabase.from("production_runs").select("*, paddy_batches(batch_number, owner_name)").order("created_at",{ascending:false}).limit(10)).data ?? [],
  });

  const selectedBatch = useMemo(() => batches?.find((b: any) => b.id === form.batch_id), [batches, form.batch_id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.batch_id) throw new Error("Select a batch");
      const used = +form.paddy_used;
      if (!used || used <= 0) throw new Error("Paddy used must be positive");
      const { error } = await supabase.from("production_runs").insert({
        batch_id: form.batch_id,
        run_date: form.run_date,
        paddy_used_qtl: used,
        rice_qtl: 0,
        bran_qtl: 0,
        broken_rice_qtl: 0,
        husk_qtl: 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paddy issued to production. Sales team will record outputs.");
      qc.invalidateQueries();
      setForm({ ...form, paddy_used: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Production Run" description="Issue paddy from a batch. Paddy stock and batch remaining auto-update. Sales team records the output (rice, bran, etc.) later." />
      <div className="mb-6"><DryingPanel /></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Run Date</Label><Input type="date" value={form.run_date} onChange={(e)=>setForm({...form, run_date: e.target.value})}/></div>
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={form.batch_id} onValueChange={(v)=>setForm({...form, batch_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                <SelectContent>
                  {(batches ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_number} · {b.owner_name} · {qtl(b.remaining_qtl)} left
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBatch && (
              <div className="sm:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono flex justify-between">
                <span>BATCH {selectedBatch.batch_number}</span>
                <span>{selectedBatch.owner_type === "government" ? "GOVT" : "PRIVATE"}</span>
                <span>REMAINING {qtl(selectedBatch.remaining_qtl, 3)}</span>
              </div>
            )}
            <div className="space-y-2"><Label>Paddy Used (qtl)</Label><Input type="number" step="0.001" value={form.paddy_used} onChange={(e)=>setForm({...form, paddy_used: e.target.value})} required/></div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Issue Paddy to Production"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Runs</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead className="text-right">Paddy</TableHead><TableHead className="text-right">Rice</TableHead><TableHead className="text-right">Rec%</TableHead></TableRow></TableHeader>
            <TableBody>
              {(runs ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs"><div className="font-mono text-primary">{r.paddy_batches?.batch_number}</div><div className="text-muted-foreground">{fmtDate(r.run_date)}</div></TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{(+r.paddy_used_qtl).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{(+r.rice_qtl).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{r.recovery_pct ? (+r.recovery_pct).toFixed(1) : "—"}</TableCell>
                </TableRow>
              ))}
              {(!runs || runs.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No runs yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
