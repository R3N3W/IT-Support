import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext, hasAtLeastRole } from "@/lib/auth/session";
import { getTicketWithMessages } from "@/lib/tickets/service";
import { listAssignableAgents } from "@/lib/users/service";
import { setStatusAction, assignAction } from "@/lib/tickets/actions";
import { TICKET_STATUSES } from "@/lib/tickets/schemas";
import { ReplyForm } from "@/components/reply-form";
import { TopBar } from "@/components/top-bar";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (!hasAtLeastRole(ctx.role, "agent")) redirect("/portal");

  const data = await getTicketWithMessages(id);
  if (!data) notFound();
  const { ticket, messages } = data;
  const agents = await listAssignableAgents();

  return (
    <>
      <TopBar ctx={ctx} home="/admin" />
      <main className="container stack">
        <Link href="/admin">← All tickets</Link>
        <h1>{ticket.subject}</h1>
        <div className="row">
          <span className="badge">{ticket.status}</span>
          <span className="badge">{ticket.priority}</span>
          <span className="muted">{ticket.channel}</span>
        </div>

        <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <form action={setStatusAction} className="row">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <select
              key={ticket.status}
              className="select"
              name="status"
              defaultValue={ticket.status}
              aria-label="Status"
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" type="submit">
              Update status
            </button>
          </form>

          <form action={assignAction} className="row">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <select
              key={ticket.assignee_id ?? "none"}
              className="select"
              name="assigneeId"
              defaultValue={ticket.assignee_id ?? ""}
              aria-label="Assignee"
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name ?? a.email}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" type="submit">
              Assign
            </button>
          </form>
        </div>

        <section className="stack">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${m.author_type === "agent" ? "msg-agent" : ""}`}
            >
              <div className="muted" style={{ fontSize: 12 }}>
                {m.author_type} · {new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          ))}
        </section>

        <ReplyForm ticketId={ticket.id} basePath="/admin" />
      </main>
    </>
  );
}
