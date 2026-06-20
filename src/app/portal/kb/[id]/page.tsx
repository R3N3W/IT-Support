import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { getArticle } from "@/lib/kb/service";
import { Markdown } from "@/components/markdown";
import { TopBar } from "@/components/top-bar";

export default async function PortalKbArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // RLS: end-users can only fetch published articles; anything else is null.
  const article = await getArticle(id);
  if (!article) notFound();

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack" style={{ maxWidth: 720 }}>
        <Link href="/portal/kb">← Help articles</Link>
        <h1>{article.title}</h1>
        <Markdown>{article.body}</Markdown>
      </main>
    </>
  );
}
