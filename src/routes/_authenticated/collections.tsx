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

export const Route = createFileRoute("/_authenticated/collections")({
  head: () => ({ meta: [{ title: "Collections — Rice Mill Ops" }] }),
  component: Collections,
});

function Collections() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    receipt_date: new Date().toISOString().slice(0,10),
    customer_id: "",
    amount: "",
    payment_mode: "cash" as "cash"|"bank"|"upi"|"cheque"|"credit",
    reference: "",
  });

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("outstanding",{ascending:false})).data ?? [] });
  const { data: recent } = useQuery({ queryKey: ["recent-collections"], queryFn: async () => (await supabase.from("collections").select("*, customers(name)").order("created_at",{ascending:false}).limit(10)).data ?? [] });

  const selected = customers?.find((c: any) => c.id === form.customer_id);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.customer_id) throw new Error("Select customer");
      const amt = +form.amount;
      if (!amt || amt <= 0) throw new Error("Amount must be positive");
      const { error } = await supabase.from("collections").insert({
        receipt_date: form.receipt_date,
        customer_id: form.customer_id,
        amount: amt,
        payment_mode: form.payment_mode,
        reference: form.reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Collection recorded"); qc.invalidateQueries(); setForm({ ...form, amount: "", reference: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Customer Collections" description="Receive payments from customers. Outstanding balance auto-reduces." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.receipt_date} onChange={(e)=>setForm({...form, receipt_date: e.target.value})}/></div>
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
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v)=>setForm({...form, customer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select customer"/></SelectTrigger>
                <SelectContent>{(customers ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} — {inr(c.outstanding)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selected && <div className="sm:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono flex justify-between"><span>OUTSTANDING</span><span className="font-semibold">{inr(selected.outstanding)}</span></div>}
            <div className="space-y-2"><Label>Amount Received (₹)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} required/></div>
            <div className="space-y-2"><Label>Reference / Cheque No.</Label><Input value={form.reference} onChange={(e)=>setForm({...form, reference: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Record Receipt"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Collections</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs"><div className="font-medium truncate">{c.customers?.name}</div><div className="text-muted-foreground">{fmtDate(c.receipt_date)} · {c.payment_mode}</div></TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{inr(c.amount)}</TableCell>
                </TableRow>
              ))}
              {(!recent || recent.length === 0) && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No collections yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
