import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { inr, qtl, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales & Dispatch — Rice Mill Ops" }] }),
  component: Sales,
});

const PRODUCTS = ["rice","bran","broken_rice","husk","paddy"] as const;
const PRODUCT_LABELS: Record<string,string> = { rice:"Rice", bran:"Bran", broken_rice:"Broken Rice", husk:"Husk", paddy:"Paddy" };

function Sales() {
  const qc = useQueryClient();
  const activeRole = typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null;
  const canEditAmount = !activeRole || activeRole === "owner" || activeRole === "accounts";
  const [form, setForm] = useState({
    sale_date: new Date().toISOString().slice(0,10),
    dispatch_type: "sale" as "sale"|"government_return",
    customer_name: "",
    agency_id: "",
    product: "rice" as typeof PRODUCTS[number],
    truck_number: "",
    quantity: "",
    rate: "",
    amount: "",
    batch_id: "",
    notes: "",
  });

  const { data: agencies } = useQuery({ queryKey: ["agencies"], queryFn: async () => (await supabase.from("govt_agencies").select("*").order("name")).data ?? [] });
  const { data: batches } = useQuery({
    queryKey: ["batches-for-sale"],
    queryFn: async () => (await supabase
      .from("paddy_batches")
      .select("id, batch_number, owner_name, owner_type, variety, net_quantity_qtl, status, production_runs(rice_qtl, bran_qtl, broken_rice_qtl, husk_qtl), sales(product, quantity_qtl)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: recent } = useQuery({ queryKey: ["recent-sales"], queryFn: async () => (await supabase.from("sales").select("*, customers(name), govt_agencies(name)").order("created_at",{ascending:false}).limit(10)).data ?? [] });

  const productKey = form.product === "broken_rice" ? "broken_rice_qtl" : `${form.product}_qtl`;
  const batchInfo = useMemo(() => {
    return (batches ?? []).map((b: any) => {
      const produced = (b.production_runs ?? []).reduce((s: number, r: any) => s + (+r[productKey] || 0), 0);
      const sold = (b.sales ?? []).filter((s: any) => s.product === form.product).reduce((s: number, r: any) => s + (+r.quantity_qtl || 0), 0);
      const available = form.product === "paddy"
        ? Math.max(0, (+b.net_quantity_qtl || 0) - sold)
        : Math.max(0, produced - sold);
      const processed = (b.production_runs ?? []).length > 0;
      return { ...b, produced, sold, available, processed };
    });
  }, [batches, productKey, form.product]);
  const selectedBatch = useMemo(() => batchInfo.find((b: any) => b.id === form.batch_id), [batchInfo, form.batch_id]);
  const computed = (+form.quantity || 0) * (+form.rate || 0);
  const total = form.amount !== "" ? +form.amount : computed;

  const create = useMutation({
    mutationFn: async () => {
      if (form.dispatch_type === "sale" && !form.customer_name.trim()) throw new Error("Enter customer name");
      if (form.dispatch_type === "government_return" && !form.agency_id) throw new Error("Select agency");
      if (!form.batch_id) throw new Error("Select source batch");
      const q = +form.quantity;
      if (!q || q <= 0) throw new Error("Quantity must be positive");
      if (selectedBatch && q > selectedBatch.available + 1e-6) {
        throw new Error(`Only ${selectedBatch.available.toFixed(3)} qtl available in batch ${selectedBatch.batch_number}`);
      }

      let customerId: string | null = null;
      if (form.dispatch_type === "sale" && form.customer_name.trim()) {
        const name = form.customer_name.trim();
        const { data: existing } = await supabase.from("customers").select("id").eq("name", name).single();
        if (existing) {
          customerId = existing.id;
        } else {
          const { data: inserted, error: custErr } = await supabase.from("customers").insert({ name }).select("id").single();
          if (custErr) throw custErr;
          customerId = inserted!.id;
        }
      }

      const { error } = await supabase.from("sales").insert({
        sale_date: form.sale_date,
        dispatch_type: form.dispatch_type,
        customer_id: customerId,
        agency_id: form.dispatch_type === "government_return" ? form.agency_id : null,
        product: form.product,
        truck_number: form.truck_number || null,
        quantity_qtl: q,
        rate: form.dispatch_type === "sale" ? (+form.rate || 0) : 0,
        total_amount: form.dispatch_type === "sale" ? total : 0,
        batch_id: form.batch_id || null,
        notes: form.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(form.dispatch_type === "sale" ? "Sale recorded" : "Government return recorded");
      qc.invalidateQueries();
      setForm({ ...form, customer_name: "", truck_number: "", quantity: "", rate: "", amount: "", batch_id: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Sales & Dispatch" description="Sell finished products or return rice to government agencies. Inventory auto-reduces." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.sale_date} onChange={(e)=>setForm({...form, sale_date: e.target.value})}/></div>
            <div className="space-y-2">
              <Label>Dispatch Type</Label>
              <Select value={form.dispatch_type} onValueChange={(v: any)=>setForm({...form, dispatch_type: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale (Private)</SelectItem>
                  <SelectItem value="government_return">Government Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.dispatch_type === "sale" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer Name</Label>
                <Input value={form.customer_name} onChange={(e)=>setForm({...form, customer_name: e.target.value})} placeholder="Enter customer name"/>
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label>Government Agency</Label>
                <Select value={form.agency_id} onValueChange={(v)=>setForm({...form, agency_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select agency"/></SelectTrigger>
                  <SelectContent>{(agencies ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.product} onValueChange={(v: any)=>setForm({...form, product: v, batch_id: ""})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{PRODUCTS.map(p => <SelectItem key={p} value={p}>{PRODUCT_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Truck Number</Label><Input value={form.truck_number} onChange={(e)=>setForm({...form, truck_number: e.target.value})}/></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Source Batch</Label>
              <Select value={form.batch_id} onValueChange={(v)=>setForm({...form, batch_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select the batch this dispatch comes from"/></SelectTrigger>
                <SelectContent>
                  {batchInfo.filter((b: any) => b.processed && b.available > 0).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_number} · {b.owner_name} · {b.variety || "—"} · {b.available.toFixed(3)} qtl {PRODUCT_LABELS[form.product]} avail
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBatch && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Batch</span><span className="font-mono">{selectedBatch.batch_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{selectedBatch.owner_name} ({selectedBatch.owner_type})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paddy variety</span><span>{selectedBatch.variety || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paddy intake</span><span className="font-mono">{qtl(selectedBatch.net_quantity_qtl, 3)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{PRODUCT_LABELS[form.product]} produced</span><span className="font-mono">{selectedBatch.produced.toFixed(3)} qtl</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already sold</span><span className="font-mono">{selectedBatch.sold.toFixed(3)} qtl</span></div>
                  <div className="flex justify-between font-medium"><span>Available now</span><span className="font-mono">{selectedBatch.available.toFixed(3)} qtl</span></div>
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Quantity (qtl) {selectedBatch && <span className="text-xs text-muted-foreground">— up to {selectedBatch.available.toFixed(3)}</span>}</Label><Input type="number" step="0.001" value={form.quantity} onChange={(e)=>setForm({...form, quantity: e.target.value})} required/></div>
            {form.dispatch_type === "sale" && canEditAmount && <>
              <div className="space-y-2"><Label>Rate (₹/qtl)</Label><Input type="number" step="0.01" value={form.rate} onChange={(e)=>setForm({...form, rate: e.target.value})}/></div>
              <div className="space-y-2">
                <Label>Amount {form.amount === "" && <span className="text-xs text-muted-foreground">(auto {inr(computed)})</span>}</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} placeholder={String(computed.toFixed(2))}/>
              </div>
            </>}
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : (form.dispatch_type === "sale" ? "Record Sale" : "Record Govt Return")}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Dispatches</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Party</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">₹</TableHead></TableRow></TableHeader>
            <TableBody>
              {(recent ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">
                    <div className="font-medium truncate">{s.customers?.name || s.govt_agencies?.name || "—"}</div>
                    <div className="text-muted-foreground">{fmtDate(s.sale_date)} · {PRODUCT_LABELS[s.product]}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{(+s.quantity_qtl).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-xs">{s.dispatch_type === "sale" ? inr(s.total_amount) : "—"}</TableCell>
                </TableRow>
              ))}
              {(!recent || recent.length === 0) && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No dispatches yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
