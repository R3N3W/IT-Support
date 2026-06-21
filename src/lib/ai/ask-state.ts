import type { EscalationReason } from "@/types/database";

export type AskCitation = { chunkId: string; articleId: string };

/** Result of an Ask-AI submission, for inline rendering in the portal. */
export type AskState =
  | { status: "idle" }
  | { status: "answered"; answer: string; citations: AskCitation[] }
  | { status: "escalated"; ticketId: string | null; reason: EscalationReason | null }
  | { status: "error"; error: string };
