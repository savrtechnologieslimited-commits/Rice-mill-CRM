import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { qtl, fmtDate, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sale/$saleId")({
  component: SaleDetail,
});

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between py-1.5 border-b border-border last:border-0"><span className="text-sm text-muted-foreground">{k}</span><span className="text-sm font-medium text-right">{v ?? "—"}</span></div>;
}

function SaleDetail() {
  const { saleId } = Route.useParams();
  const { data: s, isLoading } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: async () => (await supabase.from("sales").select("*, customers(name), govt_agencies(name), paddy_batches(id, batch_number, owner_name, variety)").eq("id", saleId).maybeSingle()).data,
  });

  if (isLoading) return <div className="max-w-3xl mx-auto p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!s) return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Sale not found" description="" />
      <Link to="/sales" className="text-primary text-sm hover:underline">← Back to sales</Link>
    </div>
  );

  const party = (s as any).customers?.name || (s as any).govt_agencies?.name || "—";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-2"><Link to="/sales" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">← SALES</Link></div>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="capitalize">{String((s as any).product).replace(/_/g," ")}</span><Badge variant="secondary" className="capitalize">{String((s as any).dispatch_type).replace(/_/g," ")}</Badge></span> as any}
        description={`${fmtDate((s as any).sale_date)} · ${party}`}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Sale</h3>
          <Row k="Date" v={fmtDate((s as any).sale_date)} />
          <Row k="Product" v={<span className="capitalize">{String((s as any).product).replace(/_/g," ")}</span>} />
          <Row k="Quantity" v={<span className="font-mono tabular-nums">{qtl((s as any).quantity_qtl)}</span>} />
          <Row k="Rate" v={<span className="font-mono">{inr((s as any).rate)}/qtl</span>} />
          <Row k="Total" v={<span className="font-mono tabular-nums font-semibold">{inr((s as any).total_amount)}</span>} />
          <Row k="Dispatch" v={<span className="capitalize">{String((s as any).dispatch_type).replace(/_/g," ")}</span>} />
          <Row k="Truck" v={(s as any).truck_number || "—"} />
          <Row k="Notes" v={(s as any).notes || "—"} />
        </Card>
        <Card className="p-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Party & Source</h3>
          <Row k="Customer / Agency" v={party} />
          <Row k="Source Batch" v={(s as any).paddy_batches ? <Link to="/batches/$batchId" params={{ batchId: (s as any).paddy_batches.id }} className="text-primary hover:underline font-mono">{(s as any).paddy_batches.batch_number}</Link> : "—"} />
          <Row k="Batch owner" v={(s as any).paddy_batches?.owner_name || "—"} />
          <Row k="Variety" v={(s as any).paddy_batches?.variety || "—"} />
          <Row k="Recorded by" v={<span className="font-mono text-xs">{(s as any).profiles?.email || "—"}</span>} />
          <Row k="Recorded at" v={<span className="text-xs">{new Date((s as any).created_at).toLocaleString("en-IN")}</span>} />
        </Card>
      </div>
    </div>
  );
}