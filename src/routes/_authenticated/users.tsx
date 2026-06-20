import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/lib/format";
import { ownerCreateUser, ownerDeleteUser } from "@/lib/users-admin.functions";

export const Route = createFileRoute("/_authenticated/users")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const createFn = useServerFn(ownerCreateUser);
  const deleteFn = useServerFn(ownerDeleteUser);
  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [] });
  const { data: roles } = useQuery({ queryKey: ["all-roles"], queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [] });

  const grant = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role granted"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("user_roles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Role removed"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (user_id: string) => { await deleteFn({ data: { user_id } }); },
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [pending, setPending] = useState<Record<string, AppRole>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", username: "", password: "", role: "procurement_manager" as AppRole });

  const create = useMutation({
    mutationFn: async () => {
      const u = form.username.trim().toLowerCase();
      const email = u.includes("@") ? u : `${u}@mill.local`;
      await createFn({ data: { full_name: form.full_name, email, password: form.password, role: form.role } });
    },
    onSuccess: () => {
      toast.success(`Account created · ${form.username}`);
      qc.invalidateQueries();
      setOpen(false);
      setForm({ full_name: "", username: "", password: "", role: "procurement_manager" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const displayName = (email: string) => email?.endsWith("@mill.local") ? email.replace(/@mill\.local$/, "") : email;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Users & Roles"
        description="Owner-only. Create accounts here — team members cannot sign up themselves. Share the username + password with them."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-2"/>Create user</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a team member</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form, full_name: e.target.value})} required/></div>
                <div className="space-y-2"><Label>Username</Label><Input type="text" autoCapitalize="none" autoCorrect="off" placeholder="e.g. sathwik123" value={form.username} onChange={(e)=>setForm({...form, username: e.target.value})} pattern="[a-zA-Z0-9_.-]+" required/><p className="text-xs text-muted-foreground">Letters, numbers, dot, underscore, hyphen. No email needed.</p></div>
                <div className="space-y-2"><Label>Temporary password</Label><Input type="text" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} minLength={6} required/><p className="text-xs text-muted-foreground">Min 6 chars. Share this with the user; they can change it later.</p></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v: AppRole)=>setForm({...form, role: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending} className="w-full">{create.isPending ? "Creating..." : "Create account"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Roles</TableHead><TableHead className="w-80">Grant Role</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {(profiles ?? []).map((p: any) => {
              const userRoles = (roles ?? []).filter((r: any) => r.user_id === p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.full_name || "—"}</div><div className="text-xs text-muted-foreground">{displayName(p.email)}</div></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{userRoles.map((r: any) => (
                    <Badge key={r.id} variant="secondary" className="gap-1.5">
                      {ROLE_LABELS[r.role]}
                      <button onClick={() => revoke.mutate(r.id)} className="hover:text-destructive" aria-label="remove">×</button>
                    </Badge>
                  ))}{userRoles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}</div></TableCell>
                  <TableCell><div className="flex gap-2">
                    <Select value={pending[p.id] || ""} onValueChange={(v: AppRole) => setPending({ ...pending, [p.id]: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Pick role" /></SelectTrigger>
                      <SelectContent>{ALL_ROLES.filter(r => !userRoles.some((ur: any) => ur.role === r)).map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" disabled={!pending[p.id]} onClick={() => { if (pending[p.id]) grant.mutate({ user_id: p.id, role: pending[p.id] }); }}>Grant</Button>
                  </div></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete ${displayName(p.email)}? This cannot be undone.`)) remove.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
