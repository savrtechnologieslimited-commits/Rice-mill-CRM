import { createFileRoute } from "@tanstack/react-router";
import { LedgerPage } from "@/components/ledger-page";

export const Route = createFileRoute("/_authenticated/cashbook")({
  head: () => ({ meta: [{ title: "Cashbook — Rice Mill Ops" }] }),
  component: () => (
    <LedgerPage
      title="Cashbook"
      description="Cash in (customer collections) and cash out (supplier payments, expenses). Updates automatically when the accountant records a cash transaction."
      modes={["cash"]}
    />
  ),
});
