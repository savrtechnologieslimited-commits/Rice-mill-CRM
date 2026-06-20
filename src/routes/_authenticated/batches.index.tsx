import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { qtl, fmtDate } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/batches/")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await supabase.from("paddy_batches").select("*").order("created_at",{ascending:false})).data ?? [],
  });
  const rows = (data ?? []).filter((b: any) =>
    !q || b.batch_number.toLowerCase().includes(q.toLowerCase()) || b.owner_name.toLowerCase().includes(q.toLowerCase()) || (b.variety || "").toLowerCase().includes(q.toLowerCase())
  );
  const statusTone: Record<string, string> = { available: "bg-success/15 text-success", drying: "bg-warning/20 text-warning-foreground", in_production: "bg-accent/20 text-accent-foreground", consumed: "bg-muted text-muted-foreground" };

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Paddy Batches" description="All paddy batches with current stock and status." actions={<Input placeholder="Search batch / owner / variety" value={q} onChange={(e)=>setQ(e.target.value)} className="w-64"/>} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Batch</TableHead><TableHead>Owner</TableHead><TableHead>Variety</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Remaining</TableHead>
            <TableHead>Moisture</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((b: any) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => window.location.assign(`/batches/${b.id}`)}>
                <TableCell className="font-mono text-primary">{b.batch_number}</TableCell>
                <TableCell>{b.owner_name}<div className="text-xs text-muted-foreground capitalize">{b.owner_type}</div></TableCell>
                <TableCell>{b.variety || "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{qtl(b.net_quantity_qtl)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums font-semibold">{qtl(b.remaining_qtl)}</TableCell>
                <TableCell>{b.moisture_pct ? `${b.moisture_pct}%` : "—"}</TableCell>
                <TableCell className="text-sm">{b.location || "—"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusTone[b.status]}>{b.status.replace("_"," ")}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(b.created_at)}</TableCell>
                <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground"/></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No batches found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
