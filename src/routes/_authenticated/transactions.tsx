import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Rice Mill Ops" }] }),
  component: TransactionsPage,
});

type Mode = "cash" | "bank" | "upi" | "cheque" | "credit";
type Row = { date: string; kind: "in"|"out"; source: string; party: string; mode: Mode; reference: string|null; amount: number };

function TransactionsPage() {
  const [filter, setFilter] = useState<"all"|"cash"|"bank"|"upi"|"cheque">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["all-txns"],
    queryFn: async (): Promise<Row[]> => {
      const [coll, pay, exp] = await Promise.all([
        supabase.from("collections").select("receipt_date, amount, payment_mode, reference, customers(name)"),
        supabase.from("supplier_payments").select("payment_date, amount, payment_mode, reference, suppliers(name)"),
        supabase.from("expenses").select("expense_date, amount, payment_mode, category, notes"),
      ]);
      const out: Row[] = [];
      (coll.data ?? []).forEach((r: any) => out.push({ date: r.receipt_date, kind: "in", source: "Collection", party: r.customers?.name ?? "—", mode: r.payment_mode, reference: r.reference, amount: +r.amount }));
      (pay.data ?? []).forEach((r: any) => out.push({ date: r.payment_date, kind: "out", source: "Supplier Payment", party: r.suppliers?.name ?? "—", mode: r.payment_mode, reference: r.reference, amount: +r.amount }));
      (exp.data ?? []).forEach((r: any) => out.push({ date: r.expense_date, kind: "out", source: "Expense", party: String(r.category).replace(/_/g," "), mode: r.payment_mode, reference: r.notes, amount: +r.amount }));
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return out;
    },
  });

  const filtered = filter === "all" ? rows : rows.filter((r) => r.mode === filter);
  const totalIn = filtered.filter(r => r.kind==="in").reduce((s,r)=>s+r.amount,0);
  const totalOut = filtered.filter(r => r.kind==="out").reduce((s,r)=>s+r.amount,0);

  const sortedAsc = [...filtered].sort((a,b)=>(a.date<b.date?-1:1));
  let run = 0; const running = new Map<Row, number>();
  sortedAsc.forEach((r)=>{ run += r.kind==="in"?r.amount:-r.amount; running.set(r, run); });

  const modes: ("all"|"cash"|"bank"|"upi"|"cheque")[] = ["all","cash","bank","upi","cheque"];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="All Transactions" description="Every cash, bank, UPI and cheque movement across collections, supplier payments and expenses." />
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Money In</div><div className="text-2xl font-mono tabular-nums text-success">{inr(totalIn)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Money Out</div><div className="text-2xl font-mono tabular-nums text-destructive">{inr(totalOut)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Net</div><div className="text-2xl font-mono tabular-nums font-semibold">{inr(totalIn-totalOut)}</div></Card>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {modes.map((m) => (
          <Button key={m} size="sm" variant={filter===m?"default":"outline"} onClick={()=>setFilter(m)} className="capitalize">{m}</Button>
        ))}
        <Link to="/cashbook" className="ml-auto text-xs text-muted-foreground hover:text-foreground self-center">Cashbook →</Link>
        <Link to="/bankbook" className="text-xs text-muted-foreground hover:text-foreground self-center">Bankbook →</Link>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Party / Category</TableHead>
            <TableHead>Mode</TableHead><TableHead>Reference</TableHead>
            <TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No transactions.</TableCell></TableRow>}
            {filtered.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fmtDate(r.date)}</TableCell>
                <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                <TableCell className="capitalize">{r.party}</TableCell>
                <TableCell className="uppercase text-xs font-mono">{r.mode}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{r.reference || "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-success">{r.kind==="in"?inr(r.amount):"—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-destructive">{r.kind==="out"?inr(r.amount):"—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{inr(running.get(r) ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}