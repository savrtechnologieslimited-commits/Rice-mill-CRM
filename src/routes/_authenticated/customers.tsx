import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({ component: Page });
function Page() {
  const { data } = useQuery({ queryKey: ["customers"], queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [] });
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Customers" description="Customers and outstanding receivables." />
      <Card><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
        <TableBody>{(data ?? []).map((s: any) => (
          <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.phone||"—"}</TableCell><TableCell>{s.gstin||"—"}</TableCell>
            <TableCell className="text-right font-mono tabular-nums font-semibold">{inr(s.outstanding)}</TableCell></TableRow>
        ))}
        {(!data || data.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No customers yet.</TableCell></TableRow>}
        </TableBody></Table></Card>
    </div>
  );
}
