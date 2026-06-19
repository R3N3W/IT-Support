import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/ai/chunk";
import {
  getEmbeddingsProvider,
  toVectorLiteral,
} from "@/lib/ai/embeddings";

/**
 * Ingest a KB article into kb_chunks: chunk the body, (re)embed only the chunks
 * whose content changed (content_hash dedupe), upsert them, and prune any chunks
 * left over from a now-shorter article. Trusted operation — uses the service
 * role and always scopes by the article's tenant_id.
 */
export interface IngestResult {
  articleId: string;
  totalChunks: number;
  embedded: number;
  reused: number;
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function ingestArticle(articleId: string): Promise<IngestResult> {
  const admin = createSupabaseAdminClient();

  const { data: article, error } = await admin
    .from("kb_articles")
    .select("id, tenant_id, body")
    .eq("id", articleId)
    .single();
  if (error || !article) {
    throw new Error(`Article not found: ${error?.message}`);
  }

  const chunks = chunkText(article.body).map((c) => ({
    ...c,
    hash: contentHash(c.content),
  }));

  const { data: existing } = await admin
    .from("kb_chunks")
    .select("chunk_index, content_hash, embedding")
    .eq("article_id", article.id);
  const existingByIndex = new Map(
    (existing ?? []).map((e) => [e.chunk_index, e]),
  );

  // Only embed chunks that are new or whose content changed.
  const stale = chunks.filter((c) => {
    const prev = existingByIndex.get(c.index);
    return !(prev && prev.content_hash === c.hash && prev.embedding != null);
  });

  const provider = getEmbeddingsProvider();
  const vectors = await provider.embed(stale.map((c) => c.content));

  const rows = stale.map((c, i) => ({
    tenant_id: article.tenant_id,
    article_id: article.id,
    chunk_index: c.index,
    content: c.content,
    token_count: c.tokenCount,
    content_hash: c.hash,
    embedding: toVectorLiteral(vectors[i]),
    embedding_model: provider.model,
  }));

  if (rows.length > 0) {
    const { error: upErr } = await admin
      .from("kb_chunks")
      .upsert(rows, { onConflict: "article_id,chunk_index" });
    if (upErr) throw new Error(`Failed to upsert chunks: ${upErr.message}`);
  }

  // Prune chunks beyond the current chunk count (article got shorter).
  const { error: delErr } = await admin
    .from("kb_chunks")
    .delete()
    .eq("article_id", article.id)
    .gte("chunk_index", chunks.length);
  if (delErr) throw new Error(`Failed to prune chunks: ${delErr.message}`);

  return {
    articleId: article.id,
    totalChunks: chunks.length,
    embedded: rows.length,
    reused: chunks.length - rows.length,
  };
}
