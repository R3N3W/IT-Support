import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { NewTicketForm } from "@/components/new-ticket-form";
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
        <NewTicketForm />
      </main>
    </>
  );
}
