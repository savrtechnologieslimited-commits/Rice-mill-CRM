import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { qtl, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pending-amounts")({
  head: () => ({ meta: [{ title: "Pending Amounts — Rice Mill Ops" }] }),
  component: PendingAmounts,
});

export function usePendingCounts() {
  return useQuery({
    queryKey: ["pending-amounts-count"],
    queryFn: async () => {
      const [batches, sales] = await Promise.all([
        supabase
          .from("paddy_batches")
          .select("id, procurements(id, total_amount)")
          .eq("owner_type", "private"),
        supabase
          .from("sales")
          .select("id")
          .eq("dispatch_type", "sale")
          .or("total_amount.is.null,total_amount.eq.0"),
      ]);
      const batchPending = (batches.data ?? []).filter((b: any) => {
        const p = b.procurements?.[0];
        return !p || !p.total_amount || +p.total_amount === 0;
      }).length;
      const salesPending = sales.data?.length ?? 0;
      return { batches: batchPending, sales: salesPending, total: batchPending + salesPending };
    },
    refetchInterval: 30000,
  });
}

function PendingAmounts() {
  const counts = usePendingCounts();

  const { data: pendingBatches } = useQuery({
    queryKey: ["pending-batches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("paddy_batches")
        .select("*, procurements(id, purchase_rate, total_amount, payment_mode, supplier_id, suppliers(name))")
        .eq("owner_type", "private")
        .order("created_at", { ascending: false });
      return (data ?? []).filter((b: any) => {
        const p = b.procurements?.[0];
        return !p || !p.total_amount || +p.total_amount === 0;
      });
    },
  });

  const { data: pendingSales } = useQuery({
    queryKey: ["pending-sales"],
    queryFn: async () => (await supabase
      .from("sales")
      .select("*, customers(name)")
      .eq("dispatch_type", "sale")
      .or("total_amount.is.null,total_amount.eq.0")
      .order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Pending Amounts"
        description="Batches and sales recorded by staff that still need their purchase or sale amount entered."
      />
      <Tabs defaultValue="batches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batches" className="gap-2">
            Purchase Amounts
            {(counts.data?.batches ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5">{counts.data?.batches}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            Sale Amounts
            {(counts.data?.sales ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5">{counts.data?.sales}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-3">
          {(pendingBatches ?? []).length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No batches pending — all purchase amounts entered.</Card>
          )}
          {(pendingBatches ?? []).map((b: any) => (
            <BatchAmountRow key={b.id} batch={b} />
          ))}
        </TabsContent>

        <TabsContent value="sales" className="space-y-3">
          {(pendingSales ?? []).length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No sales pending — all sale amounts entered.</Card>
          )}
          {(pendingSales ?? []).map((s: any) => (
            <SaleAmountRow key={s.id} sale={s} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BatchAmountRow({ batch }: { batch: any }) {
  const qc = useQueryClient();
  const existing = batch.procurements?.[0];
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash"|"bank"|"upi"|"cheque"|"credit">(existing?.payment_mode || "credit");

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
  const [supplierId, setSupplierId] = useState(existing?.supplier_id || "");

  const net = +batch.net_quantity_qtl || 0;
  const computed = (+rate || 0) * net;
  const total = amount !== "" ? +amount : computed;

  const save = useMutation({
    mutationFn: async () => {
      const r = +rate;
      if (!r || r <= 0) throw new Error("Enter rate");
      if (!total || total <= 0) throw new Error("Enter amount");
      if (existing?.id) {
        const { error } = await supabase
          .from("procurements")
          .update({ purchase_rate: r, total_amount: total, payment_mode: paymentMode, supplier_id: supplierId || existing.supplier_id })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        if (!supplierId) {
          // auto-create supplier from owner_name
          const { data: ex } = await supabase.from("suppliers").select("id").eq("name", batch.owner_name).maybeSingle();
          let sid = ex?.id;
          if (!sid) {
            const { data: ns, error: se } = await supabase.from("suppliers").insert({ name: batch.owner_name }).select("id").single();
            if (se) throw se;
            sid = ns.id;
          }
          const { error } = await supabase.from("procurements").insert({
            batch_id: batch.id, supplier_id: sid, purchase_rate: r, total_amount: total, payment_mode: paymentMode,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("procurements").insert({
            batch_id: batch.id, supplier_id: supplierId, purchase_rate: r, total_amount: total, payment_mode: paymentMode,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Amount saved");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-sm text-primary">{batch.batch_number}</div>
          <div className="text-sm font-medium">{batch.owner_name}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(batch.created_at)} · {qtl(net)} · {batch.variety || "—"}</div>
        </div>
        {existing && <Badge variant="outline">Procurement exists · amount 0</Badge>}
      </div>
      <div className="grid sm:grid-cols-5 gap-3 items-end">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Supplier {!existing && <span className="text-muted-foreground">(auto from owner)</span>}</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder={batch.owner_name}/></SelectTrigger>
            <SelectContent>{(suppliers ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate (₹/qtl)</Label>
          <Input type="number" step="0.01" value={rate} onChange={(e) => { setRate(e.target.value); setAmount(""); }}/>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount (₹)</Label>
          <Input type="number" step="0.01" value={amount === "" ? (computed ? computed.toFixed(2) : "") : amount} onChange={(e) => setAmount(e.target.value)} placeholder="auto"/>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Payment</Label>
          <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
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
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save Amount"}</Button>
      </div>
    </Card>
  );
}

function SaleAmountRow({ sale }: { sale: any }) {
  const qc = useQueryClient();
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const q = +sale.quantity_qtl || 0;
  const computed = (+rate || 0) * q;
  const total = amount !== "" ? +amount : computed;

  const save = useMutation({
    mutationFn: async () => {
      if (!total || total <= 0) throw new Error("Enter amount");
      const { error } = await supabase
        .from("sales")
        .update({ rate: +rate || (total / q), total_amount: total })
        .eq("id", sale.id);
      if (error) throw error;
      // Bump customer outstanding now that amount exists
      if (sale.customer_id) {
        const { data: cust } = await supabase.from("customers").select("outstanding").eq("id", sale.customer_id).single();
        if (cust) {
          await supabase.from("customers").update({ outstanding: (+cust.outstanding || 0) + total }).eq("id", sale.customer_id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Sale amount saved");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium">{sale.customers?.name || "—"}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(sale.sale_date)} · {sale.product?.replace(/_/g, " ")} · {qtl(q)} {sale.truck_number ? `· ${sale.truck_number}` : ""}
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Rate (₹/qtl)</Label>
          <Input type="number" step="0.01" value={rate} onChange={(e) => { setRate(e.target.value); setAmount(""); }}/>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount (₹)</Label>
          <Input type="number" step="0.01" value={amount === "" ? (computed ? computed.toFixed(2) : "") : amount} onChange={(e) => setAmount(e.target.value)} placeholder="auto"/>
        </div>
        <div>
          <Button size="sm" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save Amount"}</Button>
        </div>
      </div>
    </Card>
  );
}
