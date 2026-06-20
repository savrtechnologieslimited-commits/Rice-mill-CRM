import { createFileRoute } from "@tanstack/react-router";
import { LedgerPage } from "@/components/ledger-page";

export const Route = createFileRoute("/_authenticated/bankbook")({
  head: () => ({ meta: [{ title: "Bankbook — Rice Mill Ops" }] }),
  component: () => (
    <LedgerPage
      title="Bankbook"
      description="Bank, UPI and cheque movements across collections, supplier payments and expenses."
      modes={["bank", "upi", "cheque"]}
    />
  ),
});
