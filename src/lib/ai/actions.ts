"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { answerQuestion } from "./answer";
import { checkRateLimit } from "./rate-limit";
import { type AskState } from "./ask-state";

/** Ask-AI entry point: rate-limited, authenticated, returns answer or escalation. */
export async function askAction(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { status: "error", error: "Please enter a question." };
  if (question.length > 2000) {
    return { status: "error", error: "Question is too long (max 2000 chars)." };
  }

  let key: string;
  try {
    const ctx = await requireUser();
    key = `${ctx.tenantId}:${ctx.userId}`;
  } catch {
    return { status: "error", error: "You are not signed in." };
  }

  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return {
      status: "error",
      error: `Too many questions — try again in ${limit.retryAfter}s.`,
    };
  }

  try {
    const outcome = await answerQuestion(question);
    revalidatePath("/portal");
    if (outcome.escalated) {
      return {
        status: "escalated",
        ticketId: outcome.ticketId,
        reason: outcome.reason,
      };
    }
    return {
      status: "answered",
      answer: outcome.answer ?? "",
      citations: outcome.citations,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
