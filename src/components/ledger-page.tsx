import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDate } from "@/lib/format";

type Mode = "cash" | "bank" | "upi" | "cheque" | "credit";

type Row = {
  date: string;
  kind: "in" | "out";
  source: string;
  party: string;
  mode: Mode;
  reference: string | null;
  amount: number;
};

export function LedgerPage({ title, description, modes }: { title: string; description: string; modes: Mode[] }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ledger", modes.join(",")],
    queryFn: async (): Promise<Row[]> => {
      const [coll, pay, exp] = await Promise.all([
        supabase.from("collections").select("receipt_date, amount, payment_mode, reference, customers(name)").in("payment_mode", modes as any),
        supabase.from("supplier_payments").select("payment_date, amount, payment_mode, reference, suppliers(name)").in("payment_mode", modes as any),
        supabase.from("expenses").select("expense_date, amount, payment_mode, category, notes").in("payment_mode", modes as any),
      ]);
      const out: Row[] = [];
      (coll.data ?? []).forEach((r: any) => out.push({
        date: r.receipt_date, kind: "in", source: "Collection", party: r.customers?.name ?? "—",
        mode: r.payment_mode, reference: r.reference, amount: Number(r.amount),
      }));
      (pay.data ?? []).forEach((r: any) => out.push({
        date: r.payment_date, kind: "out", source: "Supplier Payment", party: r.suppliers?.name ?? "—",
        mode: r.payment_mode, reference: r.reference, amount: Number(r.amount),
      }));
      (exp.data ?? []).forEach((r: any) => out.push({
        date: r.expense_date, kind: "out", source: "Expense", party: String(r.category).replace(/_/g, " "),
        mode: r.payment_mode, reference: r.notes, amount: Number(r.amount),
      }));
      out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return out;
    },
  });

  const totalIn = rows.filter((r) => r.kind === "in").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.kind === "out").reduce((s, r) => s + r.amount, 0);
  const balance = totalIn - totalOut;

  // Running balance oldest → newest
  const sortedAsc = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let run = 0;
  const running = new Map<number, number>();
  sortedAsc.forEach((r, i) => { run += r.kind === "in" ? r.amount : -r.amount; running.set(i, run); });
  const runningByRow = new Map<Row, number>();
  sortedAsc.forEach((r, i) => runningByRow.set(r, running.get(i)!));

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={title} description={description} />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Money In</div><div className="text-2xl font-mono tabular-nums text-success">{inr(totalIn)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Money Out</div><div className="text-2xl font-mono tabular-nums text-destructive">{inr(totalOut)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Closing Balance</div><div className="text-2xl font-mono tabular-nums font-semibold">{inr(balance)}</div></Card>
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
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No transactions yet.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fmtDate(r.date)}</TableCell>
                <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                <TableCell className="capitalize">{r.party}</TableCell>
                <TableCell className="uppercase text-xs font-mono">{r.mode}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{r.reference || "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-success">{r.kind === "in" ? inr(r.amount) : "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-destructive">{r.kind === "out" ? inr(r.amount) : "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{inr(runningByRow.get(r) ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}