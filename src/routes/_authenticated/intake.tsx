import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { qtl, fmtDate } from "@/lib/format";
import { GodownPhotoInput } from "@/components/godown-photo-input";

export const Route = createFileRoute("/_authenticated/intake")({
  head: () => ({ meta: [{ title: "Paddy Intake — Rice Mill Ops" }] }),
  component: Intake,
});

function Intake() {
  const qc = useQueryClient();
  const activeRole = typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null;
  const canEditAmount = !activeRole || activeRole === "owner" || activeRole === "accounts";
  const [form, setForm] = useState({
    intake_date: new Date().toISOString().slice(0,10),
    truck_number: "",
    owner_type: "private" as "private"|"government",
    owner_name: "",
    govt_agency_id: "",
    variety: "",
    gross: "",
    tare: "0",
    deduction: "0",
    moisture: "",
    storage_choice: "stored" as "stored"|"drying"|"direct_production",
    location: "",
    remarks: "",
    rate: "",
    amount: "",
    storage_image_url: null as string | null,
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => (await supabase.from("govt_agencies").select("*").order("name")).data ?? [],
  });
  const { data: recent } = useQuery({
    queryKey: ["recent-intakes"],
    queryFn: async () => (await supabase.from("paddy_intakes").select("*, paddy_batches(batch_number, owner_name)").order("created_at",{ascending:false}).limit(10)).data ?? [],
  });

  const net = Math.max(0, (+form.gross || 0) - (+form.tare || 0) - (+form.deduction || 0));
  const computedAmount = net * (+form.rate || 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.owner_name) throw new Error("Owner name required");
      if (net <= 0) throw new Error("Net quantity must be positive");
      const { data: bn } = await supabase.rpc("next_batch_number");
      const { data: batch, error: be } = await supabase.from("paddy_batches").insert({
        batch_number: bn as string,
        owner_type: form.owner_type,
        owner_name: form.owner_name,
        govt_agency_id: form.owner_type === "government" ? (form.govt_agency_id || null) : null,
        variety: form.variety || null,
        net_quantity_qtl: net,
        remaining_qtl: net,
        moisture_pct: form.moisture ? +form.moisture : null,
        storage_choice: form.storage_choice,
        location: form.location || null,
        storage_image_url: form.storage_choice === "stored" ? form.storage_image_url : null,
        status: form.storage_choice === "drying" ? "drying" : "available",
      }).select().single();
      if (be) throw be;
      const { error: ie } = await supabase.from("paddy_intakes").insert({
        batch_id: batch.id,
        intake_date: form.intake_date,
        truck_number: form.truck_number || null,
        gross_weight_qtl: +form.gross,
        tare_weight_qtl: +form.tare,
        deduction_qtl: +form.deduction,
        net_quantity_qtl: net,
        moisture_pct: form.moisture ? +form.moisture : null,
        remarks: form.remarks || null,
      });
      if (ie) throw ie;
      const amt = form.amount !== "" ? +form.amount : computedAmount;
      if (amt > 0 && form.owner_type === "private") {
        const { data: existing } = await supabase.from("suppliers").select("id").eq("name", form.owner_name).maybeSingle();
        let supplierId = existing?.id;
        if (!supplierId) {
          const { data: ns, error: se } = await supabase.from("suppliers").insert({ name: form.owner_name }).select("id").single();
          if (se) throw se;
          supplierId = ns.id;
        }
        const { error: pe } = await supabase.from("procurements").insert({
          batch_id: batch.id,
          supplier_id: supplierId,
          purchase_rate: +form.rate || (amt / net),
          total_amount: amt,
          payment_mode: "credit",
        });
        if (pe) throw pe;
      }
      if (form.storage_choice === "direct_production") {
        const { error: pre } = await supabase.from("production_runs").insert({
          batch_id: batch.id,
          run_date: form.intake_date,
          paddy_used_qtl: net,
          rice_qtl: 0, bran_qtl: 0, broken_rice_qtl: 0, husk_qtl: 0,
          notes: "Auto-issued at intake (direct to production)",
        });
        if (pre) throw pre;
      }
      return batch;
    },
    onSuccess: (b) => {
      toast.success(`Batch ${b.batch_number} created`);
      qc.invalidateQueries();
      setForm({ ...form, truck_number: "", owner_name: "", variety: "", gross: "", tare: "0", deduction: "0", moisture: "", location: "", remarks: "", rate: "", amount: "", storage_image_url: null });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Paddy Intake" description="Record incoming paddy — batch number is auto-generated." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.intake_date} onChange={(e)=>setForm({...form, intake_date: e.target.value})}/></div>
            <div className="space-y-2"><Label>Truck Number</Label><Input value={form.truck_number} onChange={(e)=>setForm({...form, truck_number: e.target.value})} placeholder="MH-12-AB-1234"/></div>
            <div className="space-y-2">
              <Label>Owner Type</Label>
              <Select value={form.owner_type} onValueChange={(v: any)=>setForm({...form, owner_type: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Owner Name</Label><Input value={form.owner_name} onChange={(e)=>setForm({...form, owner_name: e.target.value})} required/></div>
            {form.owner_type === "government" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Government Agency</Label>
                <Select value={form.govt_agency_id} onValueChange={(v)=>setForm({...form, govt_agency_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select agency"/></SelectTrigger>
                  <SelectContent>{(agencies ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Variety</Label><Input value={form.variety} onChange={(e)=>setForm({...form, variety: e.target.value})}/></div>
            <div className="space-y-2"><Label>Moisture %</Label><Input type="number" step="0.01" value={form.moisture} onChange={(e)=>setForm({...form, moisture: e.target.value})}/></div>
            <div className="space-y-2"><Label>Gross Weight (qtl)</Label><Input type="number" step="0.001" value={form.gross} onChange={(e)=>setForm({...form, gross: e.target.value})} required/></div>
            <div className="space-y-2"><Label>Tare Weight (qtl)</Label><Input type="number" step="0.001" value={form.tare} onChange={(e)=>setForm({...form, tare: e.target.value})}/></div>
            <div className="space-y-2"><Label>Deduction (qtl)</Label><Input type="number" step="0.001" value={form.deduction} onChange={(e)=>setForm({...form, deduction: e.target.value})}/></div>
            <div className="space-y-2">
              <Label>Net Quantity</Label>
              <div className="h-9 rounded-md border bg-muted px-3 flex items-center font-mono tabular-nums font-semibold">{qtl(net, 3)}</div>
            </div>
            {canEditAmount && <div className="space-y-2"><Label>Rate (₹/qtl)</Label><Input type="number" step="0.01" value={form.rate} onChange={(e)=>setForm({...form, rate: e.target.value, amount: ""})} placeholder="optional"/></div>}
            {canEditAmount && <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" step="0.01" value={form.amount === "" ? (computedAmount ? computedAmount.toFixed(2) : "") : form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} placeholder="auto from rate × net"/></div>}
            <div className="space-y-2 sm:col-span-2">
              <Label>Storage Decision</Label>
              <Select value={form.storage_choice} onValueChange={(v: any)=>setForm({...form, storage_choice: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stored">Stored Directly</SelectItem>
                  <SelectItem value="drying">Sent For Drying</SelectItem>
                  <SelectItem value="direct_production">Direct To Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>{form.storage_choice === "drying" ? "Drying Yard" : "Godown / Location"}</Label><Input value={form.location} onChange={(e)=>setForm({...form, location: e.target.value})}/></div>
            {form.storage_choice === "stored" && (
              <div className="sm:col-span-2">
                <GodownPhotoInput
                  value={form.storage_image_url}
                  onChange={(p) => setForm({ ...form, storage_image_url: p })}
                  label="Godown Storage Photo (optional) — upload or take a photo"
                  folder="intake"
                />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e)=>setForm({...form, remarks: e.target.value})}/></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={create.isPending} className="w-full" size="lg">{create.isPending ? "Saving..." : "Create Intake & Batch"}</Button></div>
          </form>
        </Card>
        <Card className="p-5 h-fit">
          <h3 className="font-semibold mb-3">Recent Intakes</h3>
          <div className="space-y-3">
            {(recent ?? []).map((r: any) => (
              <div key={r.id} className="text-sm border-b border-border pb-2 last:border-0">
                <div className="font-mono text-xs text-primary">{r.paddy_batches?.batch_number}</div>
                <div className="flex justify-between"><span className="truncate">{r.paddy_batches?.owner_name}</span><span className="font-mono tabular-nums shrink-0 ml-2">{qtl(r.net_quantity_qtl)}</span></div>
                <div className="text-xs text-muted-foreground">{fmtDate(r.intake_date)} · {r.truck_number || "—"}</div>
              </div>
            ))}
            {(!recent || recent.length === 0) && <p className="text-sm text-muted-foreground">No intakes yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
