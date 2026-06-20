import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { qtl, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/govt-obligations")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["oblig-full"],
    queryFn: async () => (await supabase.from("govt_obligations").select("*, govt_agencies(name), paddy_batches(batch_number)").order("created_at",{ascending:false})).data ?? [],
  });
  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Government Obligations" description="Rice due to government from paddy received — 67% CMR ratio." />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Agency</TableHead><TableHead>Batch</TableHead>
            <TableHead className="text-right">Paddy Received</TableHead>
            <TableHead className="text-right">Rice Due</TableHead>
            <TableHead className="text-right">Rice Returned</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead>Date</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((o: any) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.govt_agencies?.name || "—"}</TableCell>
                <TableCell className="font-mono text-primary">{o.paddy_batches?.batch_number || "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(o.paddy_received_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(o.rice_due_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-success">{qtl(o.rice_returned_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums font-semibold text-accent">{qtl(+o.rice_due_qtl - +o.rice_returned_qtl)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
            {(!data || data.length === 0) && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No government obligations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
