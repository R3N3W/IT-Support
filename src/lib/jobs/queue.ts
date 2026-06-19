import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ingestArticle } from "@/lib/kb/ingest";

/**
 * Minimal tenant-scoped background queue. Trusted (service-role) code only:
 * jobs are enqueued by the KB service and processed by a worker (a Vercel Cron
 * route in a later phase). Single-worker MVP — claiming is not race-proof.
 */
export async function enqueueEmbedArticle(
  tenantId: string,
  articleId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("jobs").insert({
    tenant_id: tenantId,
    type: "embed_article",
    payload: { article_id: articleId },
  });
  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function processDueJobs(limit = 10): Promise<ProcessResult> {
  const admin = createSupabaseAdminClient();

  const { data: due, error } = await admin
    .from("jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);

  let succeeded = 0;
  let failed = 0;

  for (const job of due ?? []) {
    const attempts = job.attempts + 1;
    await admin
      .from("jobs")
      .update({ status: "running", attempts })
      .eq("id", job.id);

    try {
      if (job.type === "embed_article") {
        const articleId = (job.payload as { article_id?: string }).article_id;
        if (!articleId) throw new Error("job payload missing article_id");
        await ingestArticle(articleId);
      } else {
        throw new Error(`unknown job type: ${job.type}`);
      }

      await admin
        .from("jobs")
        .update({ status: "succeeded", last_error: null })
        .eq("id", job.id);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const giveUp = attempts >= job.max_attempts;
      await admin
        .from("jobs")
        .update({
          status: giveUp ? "failed" : "pending",
          last_error: message,
          // simple linear backoff before the next attempt
          run_after: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", job.id);
      failed++;
    }
  }

  return { processed: (due ?? []).length, succeeded, failed };
}
