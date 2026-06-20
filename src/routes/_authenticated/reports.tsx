import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "./_stubs";
export const Route = createFileRoute("/_authenticated/reports")({ component: () => <ModuleStub title="Reports" description="Paddy intake, batch stock, production, recovery, inventory, sales, government obligations, receivables, payables, cash flow." /> });
