import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/supplier-payments")({
  head: () => ({ meta: [{ title: "Supplier Payments — Rice Mill Ops" }] }),
  component: SupplierPayments,
});

function SupplierPayments() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0,10),
    supplier_id: "",
    amount: "",
    payment_mode: "bank" as "cash"|"bank"|"upi"|"cheque"|"credit",
    reference: "",
  });

  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*").order("outstanding",{ascending:false})).data ?? [] });
  const { data: recent } = useQuery({ queryKey: ["recent-supplier-payments"], queryFn: async () => (await supabase.from("supplier_payments").select("*, suppliers(name)").order("created_at",{ascending:false}).limit(10)).data ?? [] });

  const selected = suppliers?.find((s: any) => s.id === form.supplier_id);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.supplier_id) throw new Error("Select supplier");
      const amt = +form.amount;
      if (!amt || amt <= 0) throw new Error("Amount must be positive");
      const { error } = await supabase.from("supplier_payments").insert({
        payment_date: form.payment_date,
        supplier_id: form.supplier_id,
        amount: amt,
        payment_mode: form.payment_mode,
        reference: form.reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded"); qc.invalidateQueries(); setForm({ ...form, amount: "", reference: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Supplier Payments" description="Pay suppliers. Outstanding payable auto-reduces." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.payment_date} onChange={(e)=>setForm({...form, payment_date: e.target.value})}/></div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={(v: any)=>setForm({...form, payment_mode: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form, supplier_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select supplier"/></SelectTrigger>
                <SelectContent>{(suppliers ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} — {inr(s.outstanding)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selected && <div className="sm:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono flex justify-between"><span>PAYABLE</span><span className="font-semibold">{inr(selected.outstanding)}</span></div>}
            <div className="space-y-2"><Label>Amount Paid (₹)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} required/></div>
            <div className="space-y-2"><Label>Reference / Cheque No.</Label><Input value={form.reference} onChange={(e)=>setForm({...form, reference: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Record Payment"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Payments</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs"><div className="font-medium truncate">{p.suppliers?.name}</div><div className="text-muted-foreground">{fmtDate(p.payment_date)} · {p.payment_mode}</div></TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{inr(p.amount)}</TableCell>
                </TableRow>
              ))}
              {(!recent || recent.length === 0) && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No payments yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
