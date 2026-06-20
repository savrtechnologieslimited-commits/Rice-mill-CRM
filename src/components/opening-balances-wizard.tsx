import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Party = { name: string; amount: string };

const PRODUCTS = [
  { key: "paddy", label: "Paddy" },
  { key: "rice", label: "Rice" },
  { key: "bran", label: "Bran" },
  { key: "broken_rice", label: "Broken Rice" },
  { key: "husk", label: "Husk" },
] as const;

export function OpeningBalancesWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [receivables, setReceivables] = useState<Party[]>([]);
  const [payables, setPayables] = useState<Party[]>([]);

  const save = useMutation({
    mutationFn: async () => {
      // 1) Mill settings — opening cash/bank
      const { error: msErr } = await supabase
        .from("mill_settings" as any)
        .update({
          opening_cash: Number(cash) || 0,
          opening_bank: Number(bank) || 0,
          opening_balances_set: true,
          set_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (msErr) throw msErr;

      // 2) Inventory — set absolute opening quantities (upsert)
      for (const p of PRODUCTS) {
        const q = Number(stocks[p.key]) || 0;
        const { error } = await supabase
          .from("inventory")
          .upsert({ product: p.key as any, quantity_qtl: q, updated_at: new Date().toISOString() }, { onConflict: "product" });
        if (error) throw error;
      }

      // 3) Receivables — create customers with opening outstanding
      for (const r of receivables) {
        const amt = Number(r.amount) || 0;
        if (!r.name.trim() || amt <= 0) continue;
        const { error } = await supabase.from("customers").insert({ name: r.name.trim(), outstanding: amt });
        if (error) throw error;
      }

      // 4) Payables — create suppliers with opening outstanding
      for (const p of payables) {
        const amt = Number(p.amount) || 0;
        if (!p.name.trim() || amt <= 0) continue;
        const { error } = await supabase.from("suppliers").insert({ name: p.name.trim(), outstanding: amt });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Opening balances saved");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Could not save opening balances"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Welcome — Set Up Your Mill</DialogTitle>
          <DialogDescription>
            Enter the current state of your plant. Calculations will start from these opening figures. You can skip any field that is zero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Cash & Bank</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cash in hand (₹)</Label>
                <Input type="number" min="0" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Bank balance (₹)</Label>
                <Input type="number" min="0" step="0.01" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="0" />
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Stock on hand (in quintals)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRODUCTS.map((p) => (
                <div key={p.key}>
                  <Label>{p.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={stocks[p.key] || ""}
                    onChange={(e) => setStocks((s) => ({ ...s, [p.key]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Receivables (customers who owe you)</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setReceivables((r) => [...r, { name: "", amount: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {receivables.length === 0 && <p className="text-xs text-muted-foreground">None — click Add to enter pending receivables.</p>}
            {receivables.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <Input placeholder="Customer name" value={r.name} onChange={(e) => setReceivables((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input type="number" min="0" step="0.01" placeholder="Amount (₹)" value={r.amount} onChange={(e) => setReceivables((arr) => arr.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setReceivables((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payables (suppliers you owe)</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setPayables((r) => [...r, { name: "", amount: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {payables.length === 0 && <p className="text-xs text-muted-foreground">None — click Add to enter pending payables.</p>}
            {payables.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <Input placeholder="Supplier name" value={r.name} onChange={(e) => setPayables((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input type="number" min="0" step="0.01" placeholder="Amount (₹)" value={r.amount} onChange={(e) => setPayables((arr) => arr.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setPayables((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip for now</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save & start"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
