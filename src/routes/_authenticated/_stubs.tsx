import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

export function ModuleStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={title} description={description} />
      <Card className="p-8 text-center">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">Module Ready · Schema Wired</div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The database tables, RLS, and auto-calculations for this module are live. The data-entry UI for this screen is the next build step.
        </p>
      </Card>
    </div>
  );
}
