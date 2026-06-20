import { getTenantDb } from "@/lib/db/with-tenant";
import { hasAtLeastRole } from "@/lib/auth/session";
import { enqueueEmbedArticle } from "@/lib/jobs/queue";
import type { KbArticle } from "@/types/database";
import {
  createArticleSchema,
  updateArticleSchema,
  articleIdSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "./schemas";

/**
 * Knowledge base service. Reads/writes go through the RLS-bound tenant DAL, so
 * the database enforces that only agents+ can manage articles and end-users see
 * only published ones. Never uses the service role (that is for ingestion/jobs).
 */

function requireAgent(role: Parameters<typeof hasAtLeastRole>[0]) {
  if (!hasAtLeastRole(role, "agent")) throw new Error("FORBIDDEN");
}

export async function createArticle(
  input: CreateArticleInput,
): Promise<KbArticle> {
  const data = createArticleSchema.parse(input);
  const db = await getTenantDb();
  requireAgent(db.ctx.role);

  const { data: article, error } = await db.raw
    .from("kb_articles")
    .insert({
      tenant_id: db.ctx.tenantId,
      title: data.title,
      body: data.body,
      created_by: db.ctx.userId,
    })
    .select("*")
    .single();
  if (error || !article) {
    throw new Error(`Failed to create article: ${error?.message}`);
  }
  return article;
}

export async function updateArticle(
  input: UpdateArticleInput,
): Promise<KbArticle> {
  const data = updateArticleSchema.parse(input);
  const db = await getTenantDb();
  requireAgent(db.ctx.role);

  const patch: { title?: string; body?: string } = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.body !== undefined) patch.body = data.body;

  const { data: article, error } = await db.raw
    .from("kb_articles")
    .update(patch)
    .eq("id", data.articleId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();
  if (error || !article) {
    throw new Error(`Failed to update article: ${error?.message}`);
  }
  return article;
}

/** Publish an article and enqueue an embedding job for it. */
export async function publishArticle(input: {
  articleId: string;
}): Promise<KbArticle> {
  const { articleId } = articleIdSchema.parse(input);
  const db = await getTenantDb();
  requireAgent(db.ctx.role);

  const { data: article, error } = await db.raw
    .from("kb_articles")
    .update({ status: "published" })
    .eq("id", articleId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();
  if (error || !article) {
    throw new Error(`Failed to publish article: ${error?.message}`);
  }

  await enqueueEmbedArticle(db.ctx.tenantId, article.id);
  return article;
}

/** Archive an article (hidden from end-users; not deleted). */
export async function archiveArticle(input: {
  articleId: string;
}): Promise<KbArticle> {
  const { articleId } = articleIdSchema.parse(input);
  const db = await getTenantDb();
  requireAgent(db.ctx.role);

  const { data: article, error } = await db.raw
    .from("kb_articles")
    .update({ status: "archived" })
    .eq("id", articleId)
    .eq("tenant_id", db.ctx.tenantId)
    .select("*")
    .single();
  if (error || !article) {
    throw new Error(`Failed to archive article: ${error?.message}`);
  }
  return article;
}

export async function listArticles(): Promise<KbArticle[]> {
  const db = await getTenantDb();
  const { data, error } = await db.raw
    .from("kb_articles")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to list articles: ${error.message}`);
  return data ?? [];
}

/** Number of embedded chunks for an article (ingestion progress indicator). */
export async function getArticleChunkCount(articleId: string): Promise<number> {
  const db = await getTenantDb();
  const { count, error } = await db.raw
    .from("kb_chunks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", db.ctx.tenantId)
    .eq("article_id", articleId);
  if (error) throw new Error(`Failed to count chunks: ${error.message}`);
  return count ?? 0;
}

export async function getArticle(articleId: string): Promise<KbArticle | null> {
  const db = await getTenantDb();
  const { data } = await db.raw
    .from("kb_articles")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId)
    .eq("id", articleId)
    .maybeSingle();
  return data ?? null;
}
