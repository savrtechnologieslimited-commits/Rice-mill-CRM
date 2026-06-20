import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { qtl, fmtDate } from "@/lib/format";
import { GodownPhotoInput } from "./godown-photo-input";

export function DryingPanel() {
  const qc = useQueryClient();
  const { data: batches } = useQuery({
    queryKey: ["batches-drying"],
    queryFn: async () =>
      (await supabase
        .from("paddy_batches")
        .select("*")
        .eq("status", "drying")
        .order("created_at", { ascending: false })).data ?? [],
  });

  if (!batches || batches.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-2">Batches in Drying</h3>
        <p className="text-sm text-muted-foreground">No batches currently drying.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">Batches in Drying ({batches.length})</h3>
      <div className="space-y-3">
        {batches.map((b: any) => (
          <DryingRow key={b.id} batch={b} onDone={() => qc.invalidateQueries()} />
        ))}
      </div>
    </Card>
  );
}

function DryingRow({ batch, onDone }: { batch: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(batch.location ?? "");
  const [target, setTarget] = useState<"stored" | "direct_production">("stored");
  const [imagePath, setImagePath] = useState<string | null>(null);

  const finish = useMutation({
    mutationFn: async () => {
      if (target === "stored" && !location.trim()) throw new Error("Enter storage location");
      const newStatus = target === "direct_production" ? "available" : "available";
      const { error } = await supabase
        .from("paddy_batches")
        .update({
          status: newStatus,
          storage_choice: target,
          location: location.trim() || null,
          storage_image_url: target === "stored" ? imagePath : null,
        })
        .eq("id", batch.id);
      if (error) throw error;
      if (target === "direct_production") {
        const { error: pe } = await supabase.from("production_runs").insert({
          batch_id: batch.id,
          run_date: new Date().toISOString().slice(0, 10),
          paddy_used_qtl: batch.remaining_qtl,
          rice_qtl: 0, bran_qtl: 0, broken_rice_qtl: 0, husk_qtl: 0,
          notes: "Auto-issued after drying",
        });
        if (pe) throw pe;
      }
    },
    onSuccess: () => {
      toast.success("Drying complete");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
      <div className="text-sm min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-primary">{batch.batch_number}</span>
          <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">Drying</Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {batch.owner_name} · {qtl(batch.net_quantity_qtl)} · yard: {batch.location || "—"} · {fmtDate(batch.created_at)}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">Mark Drying Done</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete drying — {batch.batch_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Next step</Label>
              <div className="flex gap-2">
                <Button type="button" variant={target === "stored" ? "default" : "outline"} size="sm" onClick={() => setTarget("stored")}>Move to Storage</Button>
                <Button type="button" variant={target === "direct_production" ? "default" : "outline"} size="sm" onClick={() => setTarget("direct_production")}>Send to Production</Button>
              </div>
            </div>
            {target === "stored" && (
              <>
                <div className="space-y-2">
                  <Label>Godown / Storage Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Godown A — Stack 3" />
                </div>
                <GodownPhotoInput
                  value={imagePath}
                  onChange={setImagePath}
                  label="Godown Storage Photo (optional)"
                  folder="drying-done"
                />
              </>
            )}
            {target === "direct_production" && (
              <p className="text-xs text-muted-foreground">A production run for {qtl(batch.remaining_qtl)} will be created and appear in Production Output for recovery entry.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => finish.mutate()} disabled={finish.isPending}>{finish.isPending ? "Saving…" : "Confirm Done"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
