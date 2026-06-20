import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { qtl } from "@/lib/format";
import { Boxes } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({ component: Page });

function Page() {
  const today = new Date().toISOString().slice(0,10);
  const activeRole = typeof window !== "undefined" ? sessionStorage.getItem("mill.activeRole") : null;
  const hideSold = activeRole === "procurement_manager" || activeRole === "production_operator";
  const { data: inv } = useQuery({ queryKey: ["inv"], queryFn: async () => (await supabase.from("inventory").select("*")).data ?? [] });
  const { data: prodToday } = useQuery({ queryKey: ["pt", today], queryFn: async () => (await supabase.from("production_runs").select("*").eq("run_date", today)).data ?? [] });
  const { data: salesToday } = useQuery({ queryKey: ["st", today], enabled: !hideSold, queryFn: async () => (await supabase.from("sales").select("*").eq("sale_date", today)).data ?? [] });

  const labels: Record<string,string> = { paddy: "Paddy", rice: "Rice", bran: "Bran", broken_rice: "Broken Rice", husk: "Husk" };
  const prodKey: Record<string,string> = { rice: "rice_qtl", bran: "bran_qtl", broken_rice: "broken_rice_qtl", husk: "husk_qtl" };
  const producedToday = (p: string) => p === "paddy" ? 0 : (prodToday ?? []).reduce((s: number, r: any) => s + Number(r[prodKey[p]] ?? 0), 0);
  const soldToday = (p: string) => (salesToday ?? []).filter((s: any) => s.product === p).reduce((s: number, r: any) => s + Number(r.quantity_qtl ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Inventory" description="Live stock — updated automatically by production and sales." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(inv ?? []).map((i: any) => (
          <Card key={i.product} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{labels[i.product]}</div>
                <div className="mt-2 text-3xl font-bold font-mono tabular-nums">{qtl(i.quantity_qtl)}</div>
              </div>
              <Boxes className="h-5 w-5 text-accent" />
            </div>
            <div className={`mt-4 grid ${hideSold ? "grid-cols-1" : "grid-cols-2"} gap-2 text-xs`}>
              <div className="rounded bg-success/10 p-2"><div className="text-muted-foreground">Produced Today</div><div className="font-mono font-semibold">{qtl(producedToday(i.product))}</div></div>
              {!hideSold && (
                <div className="rounded bg-destructive/10 p-2"><div className="text-muted-foreground">Sold Today</div><div className="font-mono font-semibold">{qtl(soldToday(i.product))}</div></div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
