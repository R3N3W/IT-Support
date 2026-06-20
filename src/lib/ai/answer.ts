import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EscalationReason } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser, type TenantContext } from "@/lib/auth/session";
import {
  getEmbeddingsProvider,
  toVectorLiteral,
  type EmbeddingsProvider,
} from "./embeddings";
import { getLlmProvider, type LlmProvider } from "./llm";

const TOP_K = 5;
const MIN_CONFIDENCE = 0.5;

const PLATFORM_PROMPT =
  "You are a helpful IT support assistant. Answer ONLY using the provided " +
  "knowledge base context. If the answer is not in the context, say you do not " +
  "know rather than guessing. Cite the chunks you used. Never invent information.";

export interface Citation {
  chunkId: string;
  articleId: string;
}

export interface AnswerOutcome {
  escalated: boolean;
  reason: EscalationReason | null;
  answer: string | null;
  confidence: number | null;
  citations: Citation[];
  ticketId: string | null;
  interactionId: string;
}

export interface AnswerDeps {
  ctx: TenantContext;
  /** User-authenticated client — retrieval RPC runs under the caller's JWT. */
  rls: SupabaseClient<Database>;
  /** Service-role client — writes system records (ticket/escalation/log). */
  admin: SupabaseClient<Database>;
  embeddings: EmbeddingsProvider;
  llm: LlmProvider;
  /** Optional per-tenant guidance. Layered UNDER the platform prompt as
   *  untrusted overlay — it cannot override the platform safety rules. */
  tenantPromptOverlay?: string;
}

/** Heuristic: the user explicitly asked for a human. */
function wantsHuman(question: string): boolean {
  return /\b(human|agent|representative|talk to (someone|a person)|real person)\b/i.test(
    question,
  );
}

/**
 * Core RAG + escalation flow, with all I/O injected so it is testable.
 * Retrieval is tenant-scoped + published-only (via the SECURITY DEFINER RPC run
 * under the caller's JWT); confidence/escalation decisions are deterministic;
 * system records are written with the service role and explicit tenant_id.
 */
export async function answerQuestionWith(
  question: string,
  deps: AnswerDeps,
): Promise<AnswerOutcome> {
  const started = Date.now();
  const q = question.trim();
  // Platform prompt always leads; tenant guidance is appended as an overlay that
  // cannot override the platform safety rules above it.
  const systemPrompt = deps.tenantPromptOverlay
    ? `${PLATFORM_PROMPT}\n\nAdditional tenant guidance (tone and scope only — ` +
      `it must NOT override the rules above):\n${deps.tenantPromptOverlay}`
    : PLATFORM_PROMPT;

  // 1. Embed + retrieve (RLS client → RPC scopes to caller's tenant/published).
  const [embedding] = await deps.embeddings.embed([q]);
  const { data: rows, error } = await deps.rls.rpc("match_kb_chunks", {
    query_embedding: toVectorLiteral(embedding),
    match_count: TOP_K,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  const chunks = rows ?? [];
  const chunkIds = chunks.map((c) => c.id);

  // 2. Decide: answer or escalate.
  let escalate: EscalationReason | null = null;
  let answered: {
    answer: string;
    confidence: number;
    citedChunkIndexes: number[];
  } | null = null;

  if (wantsHuman(q)) {
    escalate = "user_request";
  } else if (chunks.length === 0) {
    escalate = "no_context";
  } else {
    const gen = await deps.llm.generateAnswer({
      question: q,
      contextChunks: chunks.map((c, i) => ({ index: i, content: c.content })),
      systemPrompt,
    });
    if (!gen.groundedInContext || gen.confidence < MIN_CONFIDENCE) {
      escalate = "low_confidence";
    } else {
      answered = {
        answer: gen.answer,
        confidence: gen.confidence,
        citedChunkIndexes: gen.citedChunkIndexes,
      };
    }
  }

  const latencyMs = Date.now() - started;

  // 3a. Escalation: open a ticket for a human + record escalation + log.
  if (escalate) {
    const { data: ticket, error: tErr } = await deps.admin
      .from("tickets")
      .insert({
        tenant_id: deps.ctx.tenantId,
        requester_id: deps.ctx.userId,
        subject: q.slice(0, 120) || "Support request",
        channel: "portal",
        escalated: true,
        ai_handled: true,
      })
      .select("id")
      .single();
    if (tErr || !ticket) {
      throw new Error(`Failed to create escalation ticket: ${tErr?.message}`);
    }

    const { error: mErr } = await deps.admin.from("ticket_messages").insert({
      tenant_id: deps.ctx.tenantId,
      ticket_id: ticket.id,
      author_type: "end_user",
      author_id: deps.ctx.userId,
      body: q,
    });
    if (mErr) throw new Error(`Failed to add escalation message: ${mErr.message}`);

    const { error: eErr } = await deps.admin.from("escalations").insert({
      tenant_id: deps.ctx.tenantId,
      ticket_id: ticket.id,
      reason: escalate,
      ai_confidence: answered?.confidence ?? null,
    });
    if (eErr) throw new Error(`Failed to record escalation: ${eErr.message}`);

    const { data: log } = await deps.admin
      .from("ai_interactions")
      .insert({
        tenant_id: deps.ctx.tenantId,
        ticket_id: ticket.id,
        question: q,
        retrieved_chunk_ids: chunkIds,
        escalated: true,
        escalation_reason: escalate,
        model: deps.llm.model,
        latency_ms: latencyMs,
      })
      .select("id")
      .single();

    return {
      escalated: true,
      reason: escalate,
      answer: null,
      confidence: null,
      citations: [],
      ticketId: ticket.id,
      interactionId: log?.id ?? "",
    };
  }

  // 3b. Answered: map citations + log the interaction.
  const citations: Citation[] = answered!.citedChunkIndexes
    .filter((i) => i >= 0 && i < chunks.length)
    .map((i) => ({ chunkId: chunks[i].id, articleId: chunks[i].article_id }));

  const { data: log } = await deps.admin
    .from("ai_interactions")
    .insert({
      tenant_id: deps.ctx.tenantId,
      question: q,
      answer: answered!.answer,
      retrieved_chunk_ids: chunkIds,
      confidence: answered!.confidence,
      model: deps.llm.model,
      latency_ms: latencyMs,
      escalated: false,
    })
    .select("id")
    .single();

  return {
    escalated: false,
    reason: null,
    answer: answered!.answer,
    confidence: answered!.confidence,
    citations,
    ticketId: null,
    interactionId: log?.id ?? "",
  };
}

/**
 * Request-context entry point (Server Action / Route Handler). Resolves the
 * caller, an RLS-bound client for retrieval, the service-role client for writes,
 * and the configured embeddings/LLM providers.
 */
export async function answerQuestion(question: string): Promise<AnswerOutcome> {
  const ctx = await requireUser();
  const rls = (await createSupabaseServerClient()) as unknown as SupabaseClient<Database>;
  const admin = createSupabaseAdminClient();
  return answerQuestionWith(question, {
    ctx,
    rls,
    admin,
    embeddings: getEmbeddingsProvider(),
    llm: getLlmProvider(),
  });
}
