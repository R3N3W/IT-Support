import { redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";

// Route the landing page by authentication + role.
export default async function Home() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  redirect(hasAtLeastRole(ctx.role, "agent") ? "/admin" : "/portal");
}
