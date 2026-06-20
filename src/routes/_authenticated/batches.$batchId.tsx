import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { qtl, fmtDate, inr } from "@/lib/format";
import { GodownPhotoThumb } from "@/components/godown-photo-input";
import {
  Wheat, Truck, ShoppingCart, Factory, Send, Pencil, Plus, Trash2, Circle, ShoppingBag,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/batches/$batchId")({
  component: BatchDetail,
});

const ENTITY_ICON: Record<string, any> = {
  batch: Wheat, intake: Truck, procurement: ShoppingCart, production_run: Factory, sale: Send,
};
const ACTION_LABEL: Record<string, string> = {
  created: "Batch created",
  updated: "Batch updated",
  deleted: "Batch deleted",
  intake_recorded: "Paddy intake recorded",
  procurement_linked: "Procurement linked",
  production_run: "Production run",
  output_recorded: "Production output recorded",
  sale_recorded: "Sale / dispatch recorded",
};
const ACTION_ICON: Record<string, any> = {
  created: Plus, updated: Pencil, deleted: Trash2,
  intake_recorded: Truck, procurement_linked: ShoppingCart, production_run: Factory, output_recorded: Factory, sale_recorded: ShoppingBag,
};

function DetailGrid({ rows }: { rows: Array<[string, any]> }) {
  const filtered = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filtered.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
      {filtered.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-mono tabular-nums text-right truncate">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function EventDetails({ action, details }: { action: string; details: any }) {
  if (!details) return null;
  const d = details.new ?? details;
  if (!d || typeof d !== "object") return null;
  switch (action) {
    case "intake_recorded":
      return <DetailGrid rows={[
        ["Intake date", d.intake_date],
        ["Truck", d.truck_number],
        ["Gross (qtl)", d.gross_weight_qtl],
        ["Tare (qtl)", d.tare_weight_qtl],
        ["Net (qtl)", d.net_quantity_qtl],
        ["Moisture %", d.moisture_pct],
        ["Bags", d.bag_count],
        ["Notes", d.notes],
      ]} />;
    case "procurement_linked":
      return <DetailGrid rows={[
        ["Rate (₹/qtl)", d.purchase_rate],
        ["Total (₹)", d.total_amount],
        ["Payment", d.payment_mode],
        ["Due date", d.due_date],
        ["Notes", d.notes],
      ]} />;
    case "production_run":
      return <DetailGrid rows={[
        ["Run date", d.run_date],
        ["Paddy used (qtl)", d.paddy_used_qtl],
        ["Rice (qtl)", d.rice_qtl],
        ["Bran (qtl)", d.bran_qtl],
        ["Broken rice (qtl)", d.broken_rice_qtl],
        ["Husk (qtl)", d.husk_qtl],
        ["Recovery %", d.recovery_pct],
        ["Notes", d.notes],
      ]} />;
    case "output_recorded":
      return <DetailGrid rows={[
        ["Rice (qtl)", d.rice_qtl],
        ["Bran (qtl)", d.bran_qtl],
        ["Broken rice (qtl)", d.broken_rice_qtl],
        ["Husk (qtl)", d.husk_qtl],
        ["Recovery %", d.recovery_pct],
      ]} />;
    case "sale_recorded":
      return <DetailGrid rows={[
        ["Sale date", d.sale_date],
        ["Product", String(d.product || "").replace(/_/g, " ")],
        ["Quantity (qtl)", d.quantity_qtl],
        ["Rate (₹/qtl)", d.rate],
        ["Total (₹)", d.total_amount],
        ["Dispatch", String(d.dispatch_type || "").replace(/_/g, " ")],
        ["Truck", d.truck_number],
        ["Payment", d.payment_mode],
        ["Notes", d.notes],
      ]} />;
    case "created":
      return <DetailGrid rows={[
        ["Batch #", d.batch_number],
        ["Owner", d.owner_name],
        ["Type", d.owner_type],
        ["Variety", d.variety],
        ["Net qty (qtl)", d.net_quantity_qtl],
        ["Moisture %", d.moisture_pct],
        ["Location", d.location],
        ["Storage", d.storage_choice],
      ]} />;
    case "updated": {
      const oldR = details.old ?? {};
      const diffs: Array<[string, any]> = [];
      for (const k of Object.keys(d)) {
        if (["updated_at","created_at","id"].includes(k)) continue;
        if (JSON.stringify(d[k]) !== JSON.stringify(oldR[k])) {
          diffs.push([k.replace(/_/g," "), `${oldR[k] ?? "—"} → ${d[k] ?? "—"}`]);
        }
      }
      return <DetailGrid rows={diffs} />;
    }
    default:
      return null;
  }
}

function BatchDetail() {
  const { batchId } = Route.useParams();
  console.log("batchId:", batchId);

  const { data: batch } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: async () => (await supabase.from("paddy_batches").select("*, govt_agencies(name)").eq("id", batchId).maybeSingle()).data,
  });
  const { data: intakes, error: intakesError } = useQuery({
    queryKey: ["batch-intakes", batchId],
    queryFn: async () => {
      const res = await supabase.from("paddy_intakes").select("*").eq("batch_id", batchId).order("created_at");
      if (res.error) { console.error("paddy_intakes error:", res.error); }
      return res.data ?? [];
    },
  });
  const { data: proc, error: procError } = useQuery({
    queryKey: ["batch-proc", batchId],
    queryFn: async () => {
      const res = await supabase.from("procurements").select("*, suppliers(name)").eq("batch_id", batchId).maybeSingle();
      if (res.error) { console.error("procurements error:", res.error); }
      return res.data;
    },
  });
  const { data: runs, error: runsError } = useQuery({
    queryKey: ["batch-runs", batchId],
    queryFn: async () => {
      const res = await supabase.from("production_runs").select("*").eq("batch_id", batchId).order("created_at");
      if (res.error) { console.error("production_runs error:", res.error); }
      return res.data ?? [];
    },
  });
  const { data: events, error: eventsError } = useQuery({
    queryKey: ["batch-audit", batchId],
    queryFn: async () => {
      const res = await supabase.from("batch_audit_log").select("*").eq("batch_id", batchId).order("created_at", { ascending: false });
      if (res.error) { console.error("batch_audit_log error:", res.error); }
      return res.data ?? [];
    },
  });

  if (!batch) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Batch not found" description="This batch may have been deleted." />
        <Link to="/batches" className="text-primary hover:underline text-sm">← Back to batches</Link>
      </div>
    );
  }

  const statusTone: Record<string, string> = {
    available: "bg-success/15 text-success", drying: "bg-warning/20 text-warning-foreground",
    in_production: "bg-accent/20 text-accent-foreground", consumed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4"><Link to="/batches" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">← BATCHES</Link></div>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="font-mono text-primary">{batch.batch_number}</span><Badge variant="secondary" className={statusTone[batch.status]}>{batch.status.replace("_"," ")}</Badge></span> as any}
        description={`${batch.owner_name} · ${batch.owner_type === "government" ? `Government (${batch.govt_agencies?.name || "—"})` : "Private"}${batch.variety ? ` · ${batch.variety}` : ""}`}
      />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">TOTAL RECEIVED</div><div className="text-2xl font-bold font-mono tabular-nums mt-1">{qtl(batch.net_quantity_qtl, 3)}</div></Card>
        <Card className="p-4"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">REMAINING</div><div className="text-2xl font-bold font-mono tabular-nums mt-1 text-primary">{qtl(batch.remaining_qtl, 3)}</div></Card>
        <Card className="p-4"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">MOISTURE / LOCATION</div><div className="text-lg font-semibold mt-1">{batch.moisture_pct ? `${batch.moisture_pct}%` : "—"} · {batch.location || "—"}</div></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Circle className="h-2 w-2 fill-primary text-primary"/>Activity Timeline</h3>
            <div className="relative pl-6 border-l-2 border-border space-y-5">
              {(events ?? []).map((e: any) => {
                const Icon = ACTION_ICON[e.action] || Pencil;
                return (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full bg-background border-2 border-primary text-primary">
                      <Icon className="h-3 w-3"/>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium text-sm">{ACTION_LABEL[e.action] || e.action}</div>
                      <div className="text-xs font-mono text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                    </div>
                    {e.summary && <div className="text-sm text-muted-foreground mt-1">{e.summary}</div>}
                    <EventDetails action={e.action} details={e.details} />
                    <div className="text-xs mt-1.5 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{e.actor_email || "system"}</Badge>
                      {e.actor_roles && <span className="text-muted-foreground capitalize">{e.actor_roles.replace(/_/g," ").replace(/,/g, " · ")}</span>}
                    </div>
                  </div>
                );
              })}
              {eventsError && <p className="text-sm text-destructive">Error loading timeline: {eventsError.message}</p>}
              {(!events || events.length === 0) && !eventsError && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">INTAKE</div>
            {(intakes ?? []).length > 0 ? (intakes ?? []).map((i: any) => (
              <div key={i.id} className="text-sm space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{fmtDate(i.intake_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Truck</span><span className="font-mono">{i.truck_number || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-mono tabular-nums">{qtl(i.gross_weight_qtl)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Net</span><span className="font-mono tabular-nums font-semibold">{qtl(i.net_quantity_qtl)}</span></div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No intake recorded.</p>}
          </Card>

          {batch.storage_image_url && (
            <Card className="p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">GODOWN STORAGE PHOTO</div>
              <GodownPhotoThumb path={batch.storage_image_url} className="w-full max-h-64 rounded object-cover border" />
              <div className="text-xs text-muted-foreground mt-2">{batch.location || "—"}</div>
            </Card>
          )}

          <Card className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">PROCUREMENT</div>
            {proc ? (
              <div className="text-sm space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium truncate ml-2">{proc.suppliers?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-mono">₹{(+proc.purchase_rate).toFixed(2)}/qtl</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono tabular-nums font-semibold">{inr(proc.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{proc.payment_mode}</span></div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Not linked to a supplier{batch.owner_type === "government" ? " (government batch)" : ""}.</p>}
          </Card>

          <Card className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">PRODUCTION RUNS</div>
            {(runs ?? []).length > 0 ? (
              <div className="space-y-3">
                {(runs ?? []).map((r: any) => (
                  <div key={r.id} className="text-sm border-b border-border pb-2 last:border-0">
                    <div className="flex justify-between"><span className="font-medium">{fmtDate(r.run_date)}</span><span className="font-mono text-xs text-muted-foreground">{r.recovery_pct ? `${(+r.recovery_pct).toFixed(1)}%` : "—"}</span></div>
                    <div className="text-xs text-muted-foreground font-mono">paddy {(+r.paddy_used_qtl).toFixed(2)} → rice {(+r.rice_qtl).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No runs yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
