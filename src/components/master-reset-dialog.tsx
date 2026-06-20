import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function MasterResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("master_reset" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All data has been reset");
      qc.invalidateQueries();
      setConfirm("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Reset failed"),
  });

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) setConfirm(""); onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Master Reset — Erase Everything</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <b>all batches, intakes, procurements, production runs, sales, collections, payments, expenses, customers, suppliers, agencies and audit history</b>, and reset all inventory & opening balances to zero. User accounts are preserved.
            <br /><br />
            Type <b>RESET</b> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label className="sr-only">Confirm</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type RESET" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirm !== "RESET" || reset.isPending}
            onClick={(e) => { e.preventDefault(); reset.mutate(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {reset.isPending ? "Erasing…" : "Erase everything"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
