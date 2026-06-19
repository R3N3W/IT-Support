import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { createTicketAction } from "@/lib/tickets/actions";
import { TICKET_PRIORITIES } from "@/lib/tickets/schemas";
import { TopBar } from "@/components/top-bar";

export default async function NewTicketPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack" style={{ maxWidth: 560 }}>
        <Link href="/portal">← My tickets</Link>
        <h1>New ticket</h1>
        <form action={createTicketAction} className="stack">
          <div>
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              className="input"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              className="select"
              defaultValue="normal"
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="body">Description</label>
            <textarea id="body" name="body" className="textarea" required />
          </div>
          <button className="btn" type="submit">
            Create ticket
          </button>
        </form>
      </main>
    </>
  );
}
