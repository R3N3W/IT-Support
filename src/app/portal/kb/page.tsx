import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { listArticles } from "@/lib/kb/service";
import { TopBar } from "@/components/top-bar";

export default async function PortalKbPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // RLS scopes this to published articles for end-users.
  const articles = await listArticles();

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>Help articles</h1>
          <Link className="btn btn-secondary" href="/portal">
            My tickets
          </Link>
        </div>
        {articles.length === 0 ? (
          <p className="muted">No help articles yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {articles.map((a) => (
              <li key={a.id} className="card">
                <Link href={`/portal/kb/${a.id}`}>{a.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
