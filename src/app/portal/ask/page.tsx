import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/session";
import { AskAiForm } from "@/components/ask-ai-form";
import { TopBar } from "@/components/top-bar";

export default async function AskPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <TopBar ctx={ctx} home="/portal" />
      <main className="container stack" style={{ maxWidth: 640 }}>
        <Link href="/portal">← My tickets</Link>
        <h1>Ask AI support</h1>
        <p className="muted">
          Answers come from your organization&apos;s published help articles. If
          we cannot answer, we will open a ticket for a human agent.
        </p>
        <AskAiForm />
      </main>
    </>
  );
}
