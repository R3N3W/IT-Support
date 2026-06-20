import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";
import { listArticles } from "@/lib/kb/service";
import { KbArticleList } from "@/components/kb-article-list";
import { TopBar } from "@/components/top-bar";

export default async function KbListPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!hasAtLeastRole(ctx.role, "agent")) redirect("/portal");

  const articles = await listArticles();

  return (
    <>
      <TopBar ctx={ctx} home="/admin" />
      <main className="container stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>Knowledge base</h1>
          <div className="row">
            <Link className="btn btn-secondary" href="/admin">
              Tickets
            </Link>
            <Link className="btn" href="/admin/kb/new">
              New article
            </Link>
          </div>
        </div>
        {articles.length === 0 ? (
          <p className="muted">No articles yet.</p>
        ) : (
          <KbArticleList articles={articles} />
        )}
      </main>
    </>
  );
}
