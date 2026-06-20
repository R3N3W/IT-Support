import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";
import { getArticle, getArticleChunkCount } from "@/lib/kb/service";
import {
  publishArticleAction,
  archiveArticleAction,
} from "@/lib/kb/actions";
import { EditArticleForm } from "@/components/edit-article-form";
import { Markdown } from "@/components/markdown";
import { TopBar } from "@/components/top-bar";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!hasAtLeastRole(ctx.role, "agent")) redirect("/portal");

  const article = await getArticle(id);
  if (!article) notFound();
  const chunkCount = await getArticleChunkCount(article.id);

  return (
    <>
      <TopBar ctx={ctx} home="/admin" />
      <main className="container stack" style={{ maxWidth: 720 }}>
        <Link href="/admin/kb">← Knowledge base</Link>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>{article.title}</h1>
          <span className="badge">{article.status}</span>
        </div>
        <p className="muted">
          {chunkCount > 0
            ? `${chunkCount} embedded chunk(s) — searchable by the AI agent.`
            : article.status === "published"
              ? "Published — embedding queued; chunks appear once the worker runs."
              : "Draft — publish to make it searchable."}
        </p>

        <EditArticleForm
          articleId={article.id}
          title={article.title}
          body={article.body}
        />

        {article.body.trim() ? (
          <section className="stack">
            <h2 style={{ fontSize: 16, margin: 0 }}>Preview (saved)</h2>
            <div className="card">
              <Markdown>{article.body}</Markdown>
            </div>
          </section>
        ) : null}

        <div className="row" style={{ gap: "1rem" }}>
          {article.status !== "published" ? (
            <form action={publishArticleAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button className="btn btn-secondary" type="submit">
                Publish
              </button>
            </form>
          ) : null}
          {article.status !== "archived" ? (
            <form action={archiveArticleAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button className="btn btn-secondary" type="submit">
                Archive
              </button>
            </form>
          ) : null}
        </div>
      </main>
    </>
  );
}
