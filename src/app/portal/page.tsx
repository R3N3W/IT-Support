import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { listTickets } from "@/lib/tickets/service";
import { TopBar } from "@/components/top-bar";

export default async function PortalPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const tickets = await listTickets({ limit: 100, offset: 0 });

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>My tickets</h1>
          <div className="row">
            <Link className="btn btn-secondary" href="/portal/kb">
              Help articles
            </Link>
            <Link className="btn" href="/portal/new">
              New ticket
            </Link>
          </div>
        </div>
        {tickets.length === 0 ? (
          <p className="muted">No tickets opened yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/portal/tickets/${t.id}`}>{t.subject}</Link>
                  </td>
                  <td>
                    <span className="badge">{t.status}</span>
                  </td>
                  <td className="muted">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
