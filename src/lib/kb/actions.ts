"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createArticle,
  updateArticle,
  publishArticle,
  archiveArticle,
} from "./service";
import { createArticleSchema, updateArticleSchema } from "./schemas";
import { type ActionState } from "@/lib/forms";

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Create a draft article, then land on its edit page. */
export async function createArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createArticleSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let id: string;
  try {
    const article = await createArticle(parsed.data);
    id = article.id;
  } catch (err) {
    return { error: messageOf(err) };
  }

  revalidatePath("/admin/kb");
  redirect(`/admin/kb/${id}`); // outside try: redirect() throws by design
}

/** Save title/body edits on an article. */
export async function updateArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateArticleSchema.safeParse({
    articleId: formData.get("articleId"),
    title: formData.get("title") ?? undefined,
    body: formData.get("body") ?? undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await updateArticle(parsed.data);
  } catch (err) {
    return { error: messageOf(err) };
  }

  revalidatePath(`/admin/kb/${parsed.data.articleId}`);
  revalidatePath("/admin/kb");
  return { error: null };
}

/** Publish an article (agents+); enqueues an embedding job. */
export async function publishArticleAction(formData: FormData) {
  const articleId = String(formData.get("articleId") ?? "");
  await publishArticle({ articleId });
  revalidatePath(`/admin/kb/${articleId}`);
  revalidatePath("/admin/kb");
}

/** Archive an article (agents+); hidden from end-users. */
export async function archiveArticleAction(formData: FormData) {
  const articleId = String(formData.get("articleId") ?? "");
  await archiveArticle({ articleId });
  revalidatePath(`/admin/kb/${articleId}`);
  revalidatePath("/admin/kb");
}
