import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar roles={roles} />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
              {user?.email}
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
