export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner / Admin",
  procurement_manager: "Procurement Manager",
  production_operator: "Production Operator",
  sales_executive: "Sales Executive",
  accounts: "Accounts",
};

export const ALL_ROLES = [
  "owner",
  "procurement_manager",
  "production_operator",
  "sales_executive",
  "accounts",
] as const;

export type AppRole = typeof ALL_ROLES[number];

export const SIGNUP_ROLES: AppRole[] = [
  "procurement_manager", "production_operator", "sales_executive", "accounts",
];

export const ROLE_HOME: Record<AppRole, string> = {
  owner: "/dashboard",
  procurement_manager: "/intake",
  production_operator: "/production",
  sales_executive: "/sales",
  accounts: "/accountant-batches",
};

export const ROLE_TAGLINE: Record<AppRole, string> = {
  owner: "Full access — dashboards, users, every module.",
  procurement_manager: "Weigh trucks, create paddy batches, link suppliers and rates.",
  production_operator: "Record milling runs and recovery.",
  sales_executive: "Dispatch rice, byproducts and govt returns.",
  accounts: "Receipts, payments, expenses and cashbook.",
};

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function inr(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "₹0";
  return inrFmt.format(v);
}

export function qtl(n: number | string | null | undefined, digits = 2): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "0 qtl";
  return `${v.toLocaleString("en-IN", { maximumFractionDigits: digits })} qtl`;
}

export function pct(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `${v.toFixed(2)}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
