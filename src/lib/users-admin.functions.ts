import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateInput = { email: string; password: string; full_name: string; role: string };

const ALLOWED_ROLES = new Set([
  "owner","procurement_manager","procurement_manager","production_operator","sales_executive","accounts",
]);

export const ownerCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateInput) => {
    if (!input?.email) throw new Error("Username or email required");
    const raw = input.email.trim();
    const email = raw.includes("@") ? raw : `${raw.toLowerCase()}@mill.local`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid username/email");
    if (!input?.password || input.password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!input?.full_name || input.full_name.length < 1) throw new Error("Full name required");
    if (!ALLOWED_ROLES.has(input.role)) throw new Error("Invalid role");
    return { ...input, email };
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("Only the Owner can create users");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, requested_role: data.role === "owner" ? null : data.role },
    });
    if (error) throw new Error(error.message);

    // Trigger handles non-owner roles. For owner role, insert explicitly.
    if (data.role === "owner" && created.user) {
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "owner" });
    }
    return { id: created.user?.id, email: created.user?.email };
  });

export const ownerDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("Only the Owner can delete users");
    if (data.user_id === context.userId) throw new Error("You can't delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
