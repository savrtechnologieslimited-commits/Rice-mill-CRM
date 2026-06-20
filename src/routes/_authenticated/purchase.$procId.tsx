import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { qtl, fmtDate, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/purchase/$procId")({
  component: PurchaseDetail,
});

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between py-1.5 border-b border-border last:border-0"><span className="text-sm text-muted-foreground">{k}</span><span className="text-sm font-medium text-right">{v ?? "—"}</span></div>;
}

function PurchaseDetail() {
  const { procId } = Route.useParams();
  const { data: p, isLoading } = useQuery({
    queryKey: ["proc", procId],
    queryFn: async () => (await supabase.from("procurements").select("*, suppliers(name), paddy_batches(id, batch_number, owner_name, variety, net_quantity_qtl)").eq("id", procId).maybeSingle()).data,
  });

  if (isLoading) return <div className="max-w-3xl mx-auto p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!p) return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Purchase not found" description="" />
      <Link to="/procurement" className="text-primary text-sm hover:underline">← Back to procurement</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-2"><Link to="/procurement" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">← PROCUREMENT</Link></div>
      <PageHeader
        title={<span className="flex items-center gap-3"><span>{(p as any).suppliers?.name || "Supplier"}</span><Badge variant="secondary" className="capitalize">{(p as any).payment_mode}</Badge></span> as any}
        description={`${fmtDate((p as any).created_at)} · ${(p as any).paddy_batches?.batch_number || "—"}`}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Purchase</h3>
          <Row k="Supplier" v={(p as any).suppliers?.name} />
          <Row k="Rate" v={<span className="font-mono">{inr((p as any).purchase_rate)}/qtl</span>} />
          <Row k="Total" v={<span className="font-mono tabular-nums font-semibold">{inr((p as any).total_amount)}</span>} />
          <Row k="Payment Mode" v={<span className="capitalize">{(p as any).payment_mode}</span>} />
          <Row k="Due Date" v={(p as any).due_date ? fmtDate((p as any).due_date) : "—"} />
          <Row k="Notes" v={(p as any).notes || "—"} />
        </Card>
        <Card className="p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Source Batch</h3>
          <Row k="Batch" v={(p as any).paddy_batches ? <Link to="/batches/$batchId" params={{ batchId: (p as any).paddy_batches.id }} className="text-primary hover:underline font-mono">{(p as any).paddy_batches.batch_number}</Link> : "—"} />
          <Row k="Owner" v={(p as any).paddy_batches?.owner_name} />
          <Row k="Variety" v={(p as any).paddy_batches?.variety || "—"} />
          <Row k="Net quantity" v={<span className="font-mono tabular-nums">{qtl((p as any).paddy_batches?.net_quantity_qtl)}</span>} />
          <Row k="Recorded by" v={<span className="font-mono text-xs">{(p as any).profiles?.email || "—"}</span>} />
          <Row k="Recorded at" v={<span className="text-xs">{new Date((p as any).created_at).toLocaleString("en-IN")}</span>} />
        </Card>
      </div>
    </div>
  );
}