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
import { inr, qtl, fmtDate } from "@/lib/format";
import { DryingPanel } from "@/components/drying-panel";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({ meta: [{ title: "Procurement — Rice Mill Ops" }] }),
  component: Procurement,
});

function Procurement() {
  const qc = useQueryClient();
  const activeRole = typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null;
  const canEditAmount = !activeRole || activeRole === "owner" || activeRole === "accounts";
  const [form, setForm] = useState({
    batch_id: "",
    supplier_id: "",
    purchase_rate: "",
    amount: "",
    payment_mode: "credit" as "cash"|"bank"|"upi"|"cheque"|"credit",
    due_date: "",
    notes: "",
  });

  const { data: batches } = useQuery({
    queryKey: ["batches-private-unlinked"],
    queryFn: async () => {
      const [b, p] = await Promise.all([
        supabase.from("paddy_batches").select("*").eq("owner_type","private").order("created_at",{ascending:false}),
        supabase.from("procurements").select("batch_id"),
      ]);
      const linked = new Set((p.data ?? []).map((x: any) => x.batch_id));
      return (b.data ?? []).filter((x: any) => !linked.has(x.id));
    },
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [] });
  const { data: recent } = useQuery({ queryKey: ["recent-procurements"], queryFn: async () => (await supabase.from("procurements").select("*, suppliers(name), paddy_batches(batch_number, net_quantity_qtl)").order("created_at",{ascending:false}).limit(10)).data ?? [] });

  const selectedBatch = useMemo(() => batches?.find((b: any) => b.id === form.batch_id), [batches, form.batch_id]);
  const computed = (selectedBatch?.net_quantity_qtl || 0) * (+form.purchase_rate || 0);
  const total = form.amount !== "" ? +form.amount : computed;

  const create = useMutation({
    mutationFn: async () => {
      if (!form.batch_id) throw new Error("Select batch");
      if (!form.supplier_id) throw new Error("Select supplier");
      const rate = +form.purchase_rate || 0;
      if (canEditAmount && (!rate || rate <= 0)) throw new Error("Rate must be positive");
      const { error } = await supabase.from("procurements").insert({
        batch_id: form.batch_id,
        supplier_id: form.supplier_id,
        purchase_rate: rate,
        total_amount: canEditAmount ? total : 0,
        payment_mode: form.payment_mode,
        due_date: form.due_date || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Procurement recorded");
      qc.invalidateQueries();
      setForm({ ...form, batch_id: "", purchase_rate: "", amount: "", due_date: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Procurement" description="Link a private paddy batch to a supplier with rate and payment terms. Credit purchases auto-create payables." />
      <div className="mb-6"><DryingPanel /></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Paddy Batch (unlinked private)</Label>
              <Select value={form.batch_id} onValueChange={(v)=>setForm({...form, batch_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                <SelectContent>
                  {(batches ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.batch_number} · {b.owner_name} · {qtl(b.net_quantity_qtl)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form, supplier_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select supplier"/></SelectTrigger>
                <SelectContent>{(suppliers ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {canEditAmount && <div className="space-y-2"><Label>Purchase Rate (₹/qtl)</Label><Input type="number" step="0.01" value={form.purchase_rate} onChange={(e)=>setForm({...form, purchase_rate: e.target.value})} required/></div>}
            {canEditAmount && <div className="space-y-2">
              <Label>Amount {form.amount === "" && <span className="text-xs text-muted-foreground">(auto {inr(computed)})</span>}</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} placeholder={String(computed.toFixed(2))}/>
            </div>}
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={(v: any)=>setForm({...form, payment_mode: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Due Date {form.payment_mode !== "credit" && <span className="text-xs text-muted-foreground">(optional)</span>}</Label><Input type="date" value={form.due_date} onChange={(e)=>setForm({...form, due_date: e.target.value})}/></div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Record Procurement"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Procurements</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    <div className="font-medium truncate">{p.suppliers?.name}</div>
                    <div className="text-muted-foreground font-mono">{p.paddy_batches?.batch_number} · {fmtDate(p.created_at)} · {p.payment_mode}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{inr(p.total_amount)}</TableCell>
                </TableRow>
              ))}
              {(!recent || recent.length === 0) && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No procurements yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
