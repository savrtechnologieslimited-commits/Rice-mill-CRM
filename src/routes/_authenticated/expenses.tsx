import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Rice Mill Ops" }] }),
  component: Expenses,
});

const CATS = ["labour","diesel","electricity","repairs","transport","packing","miscellaneous"] as const;
const CAT_LABEL: Record<string,string> = { labour:"Labour", diesel:"Diesel", electricity:"Electricity", repairs:"Repairs", transport:"Transport", packing:"Packing", miscellaneous:"Miscellaneous" };

function Expenses() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0,10),
    category: "labour" as typeof CATS[number],
    amount: "",
    payment_mode: "cash" as "cash"|"bank"|"upi"|"cheque"|"credit",
    notes: "",
  });

  const { data: recent } = useQuery({ queryKey: ["recent-expenses"], queryFn: async () => (await supabase.from("expenses").select("*").order("created_at",{ascending:false}).limit(15)).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const amt = +form.amount;
      if (!amt || amt <= 0) throw new Error("Amount must be positive");
      const { error } = await supabase.from("expenses").insert({
        expense_date: form.expense_date,
        category: form.category,
        amount: amt,
        payment_mode: form.payment_mode,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense recorded"); qc.invalidateQueries(); setForm({ ...form, amount: "", notes: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Expenses" description="Track daily operating expenses by category and payment mode." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e)=>setForm({...form, expense_date: e.target.value})}/></div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v: any)=>setForm({...form, category: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} required/></div>
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
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Record Expense"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Expenses</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs"><div className="font-medium">{CAT_LABEL[e.category]}</div><div className="text-muted-foreground">{fmtDate(e.expense_date)} · {e.payment_mode}</div></TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{inr(e.amount)}</TableCell>
                </TableRow>
              ))}
              {(!recent || recent.length === 0) && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No expenses yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
