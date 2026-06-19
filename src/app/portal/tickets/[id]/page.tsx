import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { getTicketWithMessages } from "@/lib/tickets/service";
import { ReplyForm } from "@/components/reply-form";
import { RequesterStatusControl } from "@/components/requester-status-control";
import { TopBar } from "@/components/top-bar";

export default async function PortalTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const data = await getTicketWithMessages(id);
  if (!data) notFound();
  const { ticket, messages } = data;

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack">
        <Link href="/portal">← My tickets</Link>
        <h1>{ticket.subject}</h1>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <span className="badge">{ticket.status}</span>
            <span className="badge">{ticket.priority}</span>
          </div>
          <RequesterStatusControl ticketId={ticket.id} status={ticket.status} />
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

        <ReplyForm ticketId={ticket.id} basePath="/portal" />
      </main>
    </>
  );
}
