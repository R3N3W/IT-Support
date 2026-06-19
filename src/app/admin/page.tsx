import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";
import { listTickets } from "@/lib/tickets/service";
import { TopBar } from "@/components/top-bar";

export default async function AdminPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!hasAtLeastRole(ctx.role, "agent")) redirect("/portal");

  const tickets = await listTickets({ limit: 100, offset: 0 });

  return (
    <>
      <TopBar ctx={ctx} home="/admin" />
      <main className="container stack">
        <h1>Tickets</h1>
        {tickets.length === 0 ? (
          <p className="muted">No tickets yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/tickets/${t.id}`}>{t.subject}</Link>
                  </td>
                  <td>
                    <span className="badge">{t.status}</span>
                  </td>
                  <td>{t.priority}</td>
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
