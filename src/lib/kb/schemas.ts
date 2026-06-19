import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(100_000).default(""),
});
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = z.object({
  articleId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
});
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const articleIdSchema = z.object({ articleId: z.string().uuid() });
export type ArticleIdInput = z.infer<typeof articleIdSchema>;
