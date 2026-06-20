import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Truck, Package, ShoppingCart, Factory, Boxes,
  Send, IndianRupee, Wallet, Landmark, Receipt, FileBarChart,
  Building2, Users, UserCog, LogOut, Wheat, ChevronRight, BellRing,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/auth";
import { usePendingCounts } from "@/routes/_authenticated/pending-amounts";

type Item = { title: string; to: string; icon: any; roles?: AppRole[] };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Overview", items: [
    { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { title: "All Transactions", to: "/transactions", icon: Wallet, roles: ["accounts","production_operator"] },
  ]},
  { label: "Operations", items: [
    { title: "Paddy Intake", to: "/intake", icon: Truck, roles: ["procurement_manager"] },
    { title: "Paddy Batches", to: "/batches", icon: Package },
    { title: "Procurement", to: "/procurement", icon: ShoppingCart, roles: ["procurement_manager"] },
    { title: "Production", to: "/production", icon: Factory, roles: ["production_operator"] },
    { title: "Production Output", to: "/production-output", icon: Factory, roles: ["sales_executive"] },
    { title: "Inventory", to: "/inventory", icon: Boxes },
    { title: "Sales & Dispatch", to: "/sales", icon: Send, roles: ["sales_executive"] },
  ]},
  { label: "Finance", items: [
    { title: "Pending Amounts", to: "/pending-amounts", icon: BellRing, roles: ["accounts"] },
    { title: "Batch Payments", to: "/accountant-batches", icon: IndianRupee, roles: ["accounts"] },
    { title: "Collections", to: "/collections", icon: IndianRupee, roles: ["accounts"] },
    { title: "Supplier Payments", to: "/supplier-payments", icon: IndianRupee, roles: ["procurement_manager"] },
    { title: "Expenses", to: "/expenses", icon: Receipt, roles: ["accounts"] },
    { title: "Cashbook", to: "/cashbook", icon: Wallet, roles: ["accounts"] },
    { title: "Bankbook", to: "/bankbook", icon: Landmark, roles: ["accounts"] },
  ]},
  { label: "Master & Govt", items: [
    { title: "Suppliers", to: "/suppliers", icon: Building2, roles: ["procurement_manager","accounts"] },
    { title: "Customers", to: "/customers", icon: Users, roles: ["sales_executive","accounts"] },
  ]},
  { label: "Reports", items: [
    { title: "Reports", to: "/reports", icon: FileBarChart },
  ]},
  { label: "Admin", items: [
    { title: "Users & Roles", to: "/users", icon: UserCog, roles: [] },
  ]},
];

export function AppSidebar({ roles }: { roles: AppRole[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isOwner = roles.includes("owner");
  const activeRole = (typeof window !== "undefined"
    ? (sessionStorage.getItem("mill.activeRole") as AppRole | null)
    : null);
  // The "view lens": for owner, scope sidebar to whichever role they signed in as.
  // For multi-role staff, also honor their choice. Owner picking "owner" => see everything.
  const lens: AppRole[] =
    activeRole && activeRole !== "owner" ? [activeRole] : roles;
  const lensIsOwner = lens.includes("owner");
  const showPending = can(lens, ["accounts"]) || lensIsOwner;
  const pending = usePendingCounts();
  const pendingTotal = showPending ? (pending.data?.total ?? 0) : 0;

  async function signOut() {
    sessionStorage.removeItem("mill.activeRole");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Wheat className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Rice Mill Ops</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/60 truncate">
                {(activeRole ?? (isOwner ? "owner" : roles[0]))?.replace(/_/g, " ") || "—"}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => {
          const visible = g.items.filter((it) => {
            if (g.label === "Admin") return isOwner && lensIsOwner;
            if (it.to === "/pending-amounts") return showPending;
            if (!it.roles || it.roles.length === 0) return true;
            return can(lens, it.roles);
          });
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((it) => {
                    const active = pathname === it.to || pathname.startsWith(it.to + "/");
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={it.to as any} className="flex items-center gap-2">
                            <it.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{it.title}</span>
                            {it.to === "/pending-amounts" && pendingTotal > 0 && !collapsed && (
                              <Badge variant="destructive" className="ml-auto h-5 px-1.5">{pendingTotal}</Badge>
                            )}
                            {active && !collapsed && it.to !== "/pending-amounts" && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
