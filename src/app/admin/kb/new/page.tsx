import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";
import { NewArticleForm } from "@/components/new-article-form";
import { TopBar } from "@/components/top-bar";

export default async function NewArticlePage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!hasAtLeastRole(ctx.role, "agent")) redirect("/portal");

  return (
    <>
      <TopBar ctx={ctx} home="/admin" />
      <main className="container stack" style={{ maxWidth: 720 }}>
        <Link href="/admin/kb">← Knowledge base</Link>
        <h1>New article</h1>
        <NewArticleForm />
      </main>
    </>
  );
}
