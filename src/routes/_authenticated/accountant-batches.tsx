import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/accountant-batches")({
  head: () => ({ meta: [{ title: "Batch Payments — Rice Mill Ops" }] }),
  component: Page,
});

function Page() {
  const { data: pay } = useQuery({
    queryKey: ["batch-payables"],
    queryFn: async () => ((await (supabase as any).from("batch_payables").select("*").order("procurement_date", { ascending: false })).data ?? []),
  });
  const { data: recv } = useQuery({
    queryKey: ["batch-receivables"],
    queryFn: async () => ((await (supabase as any).from("batch_receivables").select("*").order("last_sale_date", { ascending: false })).data ?? []),
  });

  const onlyDue = (rows: any[]) => rows.filter((r) => Number(r.outstanding) > 0.01);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Batch Payments" description="Record payments made to suppliers and received from customers, batch-wise. Pulls in details entered by procurement and sales." />
      <Tabs defaultValue="payable">
        <TabsList>
          <TabsTrigger value="payable">To Pay (Suppliers) · {onlyDue(pay ?? []).length}</TabsTrigger>
          <TabsTrigger value="receivable">To Collect (Customers) · {onlyDue(recv ?? []).length}</TabsTrigger>
        </TabsList>

        <TabsContent value="payable">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Batch</TableHead><TableHead>Owner</TableHead><TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead><TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(pay ?? []).map((r: any) => (
                  <TableRow key={r.batch_id}>
                    <TableCell className="font-mono text-primary">{r.batch_number}</TableCell>
                    <TableCell>{r.owner_name}<div className="text-xs text-muted-foreground capitalize">{r.variety || "—"}</div></TableCell>
                    <TableCell>{r.supplier_name || "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDate(r.procurement_date)}{r.due_date && <div className="text-muted-foreground">Due {fmtDate(r.due_date)}</div>}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inr(r.purchase_rate)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inr(r.total_amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inr(r.paid_amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{Number(r.outstanding) > 0.01 ? <span className="text-destructive">{inr(r.outstanding)}</span> : <Badge variant="secondary" className="bg-success/15 text-success">Settled</Badge>}</TableCell>
                    <TableCell className="text-right">{Number(r.outstanding) > 0.01 && <PayDialog mode="pay" row={r} />}</TableCell>
                  </TableRow>
                ))}
                {(!pay || pay.length === 0) && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6 text-sm">No procurement entries yet. Ask procurement to record a batch purchase.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="receivable">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Batch</TableHead><TableHead>Owner</TableHead><TableHead>Customer</TableHead>
                <TableHead>Last Sale</TableHead>
                <TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(recv ?? []).map((r: any, i: number) => (
                  <TableRow key={r.batch_id + "-" + (r.customer_id ?? i)}>
                    <TableCell className="font-mono text-primary">{r.batch_number}</TableCell>
                    <TableCell>{r.owner_name}<div className="text-xs text-muted-foreground">{r.variety || "—"}</div></TableCell>
                    <TableCell>{r.customer_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.last_sale_date ? fmtDate(r.last_sale_date) : "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inr(r.sold_amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inr(r.collected_amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{Number(r.outstanding) > 0.01 ? <span className="text-destructive">{inr(r.outstanding)}</span> : <Badge variant="secondary" className="bg-success/15 text-success">Settled</Badge>}</TableCell>
                    <TableCell className="text-right">{Number(r.outstanding) > 0.01 && <PayDialog mode="receive" row={r} />}</TableCell>
                  </TableRow>
                ))}
                {(!recv || recv.length === 0) && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-sm">No batch-tagged sales yet. Ask sales to tag a batch when recording a sale.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MODES = ["cash", "bank", "upi", "cheque", "credit"] as const;

function PayDialog({ mode, row }: { mode: "pay" | "receive"; row: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: String(row.outstanding ?? ""),
    payment_mode: "cash" as typeof MODES[number],
    reference: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const amt = +f.amount;
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const base = { batch_id: row.batch_id, amount: amt, payment_mode: f.payment_mode, reference: f.reference || null };
      if (mode === "pay") {
        const { error } = await supabase.from("supplier_payments").insert({ ...base, supplier_id: row.supplier_id, payment_date: f.date });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("collections").insert({ ...base, customer_id: row.customer_id, receipt_date: f.date });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "pay" ? "Payment recorded" : "Receipt recorded");
      qc.invalidateQueries();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={mode === "pay" ? "default" : "secondary"}>{mode === "pay" ? "Record Payment" : "Record Receipt"}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "pay" ? "Pay Supplier" : "Collect from Customer"} · <span className="font-mono text-primary">{row.batch_number}</span></DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-4">
          {mode === "pay" ? row.supplier_name : row.customer_name} · Outstanding <span className="font-mono">{inr(row.outstanding)}</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Amount</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Mode</Label>
              <Select value={f.payment_mode} onValueChange={(v: any) => setF({ ...f, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Reference</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Cheque #, UPI ref, …" /></div>
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
