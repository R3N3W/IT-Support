# Architecture — Multi-Tenant IT Support SaaS

> Status: Phase 1 design. No application code yet.
> Last updated: 2026-06-18.

## 1. Product summary

A turnkey, multi-tenant SaaS sold to small companies. Each **tenant** (client
company) gets:

- A **ticketing system** (create, triage, assign, resolve support tickets).
- An **end-user support portal/widget** embeddable on the tenant's own site/app.
- An **admin dashboard** for the tenant's support staff and admins.
- An **AI support agent** that answers from *that tenant's own knowledge base*
  via RAG, and **escalates to a human** when confidence is low.

The defining constraint of the whole system: **tenant data is strictly
isolated**. A query, an embedding search, an AI answer, or a ticket must never
cross a tenant boundary.

## 2. Chosen stack

| Concern            | Choice                                               |
| ------------------ | ---------------------------------------------------- |
| App framework      | Next.js (App Router, TypeScript), React Server Comp. |
| Hosting            | Vercel                                               |
| Database           | Supabase Postgres                                    |
| Vector search      | `pgvector` extension in the same Postgres DB         |
| Auth               | Supabase Auth (JWT with tenant claims)               |
| File storage       | Supabase Storage (KB source docs, attachments)       |
| LLM (generation)   | Anthropic Claude (`claude-sonnet-4-6` default)       |
| Embeddings         | Voyage AI (`voyage-3` family)                        |
| Background jobs    | Vercel Cron + a Postgres-backed job queue table      |

Rationale: Supabase gives managed Postgres + pgvector + Auth + Storage in one
place, and its **Row-Level Security (RLS)** is the cornerstone of our isolation
model — isolation is enforced *in the database*, not only in application code.

## 3. Multi-tenancy & data-isolation model

### 3.1 Model: shared schema + Row-Level Security

- **One** database, **one** schema. Every tenant-scoped table carries a
  non-null `tenant_id uuid` column.
- Postgres **RLS policies** on every tenant-scoped table restrict all
  `SELECT/INSERT/UPDATE/DELETE` to rows where `tenant_id` matches the caller's
  tenant. The database refuses cross-tenant access even if app code has a bug.
- Chosen over schema-per-tenant / database-per-tenant because we target *many
  small companies*: cheapest to operate, fastest onboarding, single migration
  path, and RLS provides DB-enforced isolation. (Trade-offs in §10.)

### 3.2 How the tenant identity reaches the database

1. A user authenticates via Supabase Auth. Their JWT carries custom claims:
   `tenant_id` and `role` (set via a Supabase Auth hook / `app_metadata` at
   provisioning time, never client-writable).
2. Supabase passes the JWT to Postgres; claims are readable via
   `auth.jwt() ->> 'tenant_id'`.
3. RLS policies compare row `tenant_id` against
   `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`.

```sql
-- Canonical policy shape (applied to every tenant-scoped table).
alter table public.tickets enable row level security;
alter table public.tickets force row level security;

create policy tenant_isolation_select on public.tickets
  for select using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
-- analogous policies for insert (with check), update (using + with check),
-- delete. INSERT/UPDATE WITH CHECK prevents writing rows into another tenant.
```

### 3.3 Three trust zones (defense in depth)

1. **Browser / widget** — only ever uses the Supabase *anon* key. All access is
   constrained by RLS. The embeddable widget uses a separate, scoped
   **widget token** (per-tenant, public-installable) that maps to an
   anonymous/limited end-user role — never the service key.
2. **App server (Next.js route handlers / server actions on Vercel)** — runs
   as the authenticated user (RLS still applies). A request-scoped helper
   resolves `tenant_id` from the session and refuses to proceed without it.
3. **Trusted backend jobs (ingestion, embeddings, evals)** — may use the
   Supabase *service-role* key, which **bypasses RLS**. These code paths MUST
   set `tenant_id` explicitly on every row and filter every query by it. This
   is the highest-risk zone and is gated by the `security-reviewer` agent.

### 3.4 Isolation guardrails (enforced, not just documented)

- A shared `withTenant(tenantId)` data-access layer is the *only* sanctioned way
  to read/write tenant data; raw service-role queries are lint-flagged.
- Every tenant table: `tenant_id` non-null + FK to `tenants(id)` + composite
  indexes leading with `tenant_id`.
- Vector search queries always include a `tenant_id =` predicate *in addition*
  to RLS (belt and suspenders; also lets the planner use the partial/composite
  index).
- Automated test: a fixture seeds two tenants; a suite asserts tenant A can
  never read/write tenant B across every endpoint and every table.

## 4. Core data entities

All tenant-scoped tables have `id uuid pk`, `tenant_id uuid not null`,
`created_at`, `updated_at`.

| Entity            | Purpose / key fields |
| ----------------- | -------------------- |
| `tenants`         | The client company. `name`, `slug`, `plan`, `status`, `settings` (jsonb), `created_at`. **Not** tenant-scoped (it *is* the tenant). |
| `tenant_settings` | Per-tenant AI config: `system_prompt`, `model`, `temperature`, `confidence_threshold`, `escalation_policy`, branding, locale. (May live in `tenants.settings` jsonb for MVP.) |
| `users`           | Maps to Supabase `auth.users`. `tenant_id`, `role` (`owner`/`admin`/`agent`/`end_user`), `display_name`, `email`. |
| `tickets`         | `tenant_id`, `requester_id`, `assignee_id?`, `subject`, `status` (`open`/`pending`/`resolved`/`closed`), `priority`, `channel` (`widget`/`email`/`portal`), `ai_handled` (bool), `escalated` (bool). |
| `ticket_messages` | Thread on a ticket. `ticket_id`, `tenant_id`, `author_type` (`end_user`/`agent`/`ai`/`system`), `author_id?`, `body`, `attachments`. |
| `kb_articles`     | Knowledge base source. `tenant_id`, `title`, `body` (markdown), `source` (`manual`/`upload`/`url`), `status` (`draft`/`published`/`archived`), `version`. |
| `kb_chunks`       | Chunked article text for retrieval. `tenant_id`, `article_id`, `chunk_index`, `content`, `token_count`, `embedding vector(1024)`, `content_hash`. |
| `escalations`     | `tenant_id`, `ticket_id`, `reason` (`low_confidence`/`no_context`/`user_request`/`policy`), `ai_confidence`, `created_at`, `resolved_at?`. |
| `ai_interactions` | Audit/eval log. `tenant_id`, `ticket_id?`, `question`, `retrieved_chunk_ids`, `answer`, `confidence`, `model`, `latency_ms`, `escalated`, `token_usage`, `feedback?`. |
| `eval_cases`      | Per-tenant eval set. `tenant_id`, `question`, `expected_answer?`, `expected_behavior` (`answer`/`escalate`), `tags`. |
| `eval_runs`       | `tenant_id`, `started_at`, `model`, `config_snapshot`, aggregate `metrics` (jsonb). |
| `eval_results`    | `tenant_id`, `eval_run_id`, `eval_case_id`, `passed`, `score`, `actual_answer`, `actual_behavior`. |
| `jobs`            | Background work queue. `tenant_id?`, `type` (`ingest`/`embed`/`eval`), `payload`, `status`, `attempts`, `run_after`. |
| `audit_log`       | `tenant_id`, `actor_id`, `action`, `target`, `metadata`, `created_at`. Security-relevant events. |

### 4.1 Embeddings detail

- `kb_chunks.embedding` is `vector(1024)` (Voyage `voyage-3` dimensionality;
  pin the exact model + dim in `tenant_settings`/config and store the model name
  per chunk so re-embeddings are unambiguous).
- Index: `ivfflat`/`hnsw` on `embedding` with cosine ops, plus a composite
  index leading with `tenant_id` so retrieval is both isolated and fast.
- `content_hash` lets ingestion skip re-embedding unchanged chunks.

## 5. AI support flow (RAG + escalation)

```
end-user question (widget/portal)
        │
        ▼
[1] guardrail / preprocess  ── PII scrub, length cap, prompt-injection screen
        │
        ▼
[2] embed question (Voyage)  ── tenant-scoped
        │
        ▼
[3] retrieve top-k kb_chunks ── WHERE tenant_id = $t  (RLS + explicit filter)
        │
        ▼
[4] build prompt  ── tenant system_prompt + retrieved context + question
        │
        ▼
[5] Claude generates answer + self-reported grounding/confidence signals
        │
        ▼
[6] confidence / escalation gate
        ├── confident & grounded ──► return answer, log ai_interaction
        └── low confidence / no context / user asks / policy match
                                   ──► create escalation + ticket for human
```

### 5.1 Retrieval (RAG)

- Per-tenant KB only. Retrieval query is always filtered by `tenant_id`.
- Top-k (configurable, default k=5) chunks by cosine similarity, optionally
  re-ranked. A minimum-similarity floor: if the best chunk is below threshold,
  treat as **no usable context** → escalate rather than hallucinate.
- Prompt instructs Claude to answer *only* from provided context and to say
  when the answer isn't in the KB.

### 5.2 Per-tenant configurable system prompt

- Each tenant has a `system_prompt` (brand voice, scope, do/don't rules) plus
  structured config: `model`, `temperature`, `confidence_threshold`,
  `escalation_policy`, `locale`, allowed/blocked topics.
- The effective prompt = platform base prompt (safety, format, "ground in
  context") + tenant overlay. Tenant prompt cannot override platform safety
  rules (composed server-side; tenant input is treated as untrusted data).

### 5.3 Confidence & escalation logic

Escalate when **any** of:

1. **Low retrieval confidence** — top similarity below `confidence_threshold`,
   or insufficient context coverage.
2. **Low generation confidence** — model signals uncertainty / refuses /
   answer not grounded in cited chunks (we ask the model to cite chunk ids and
   verify the citations exist).
3. **Explicit user request** — "talk to a human".
4. **Policy triggers** — topics the tenant marked must-escalate (billing,
   security, legal), detected sentiment (angry), or repeated failed answers.

On escalation: create an `escalation` row + a `ticket` (or attach to existing
thread), notify tenant agents, and hand the conversation transcript over. The
AI never silently guesses on low confidence.

### 5.4 Eval harness

- **Per-tenant eval sets** (`eval_cases`): real/representative questions with
  `expected_behavior` (should answer vs should escalate) and optional expected
  answers.
- **Runner** executes the full RAG flow against a config snapshot, records
  `eval_results`, and computes metrics: answer relevance/groundedness
  (LLM-as-judge with Claude), retrieval hit-rate, correct-escalation rate,
  false-answer rate (answered when it should have escalated), latency, cost.
- **Gates:** config/prompt changes for a tenant can be evaluated before
  publishing; regressions block rollout. Run on a schedule (Vercel Cron) and on
  KB changes.
- All eval data is tenant-scoped like everything else.

### 5.5 Prompt-injection / content safety

- KB content and user questions are **untrusted**. Retrieved context is wrapped
  and clearly delimited; the model is instructed that context is reference data,
  not instructions.
- Strip/flag injection patterns ("ignore previous instructions…") in ingestion
  and at query time. The `security-reviewer` agent owns this surface.
- Outbound answers screened for leaking system prompt / other-tenant signals.

## 6. Authentication & authorization

- **Supabase Auth** for identity (email/password + OAuth as needed). Sessions
  are JWTs.
- **Tenant binding:** at user provisioning, `tenant_id` + `role` are written to
  the user's `app_metadata` (server-side only) and surface as JWT claims. Users
  cannot change their own tenant or role.
- **Roles:** `owner` > `admin` > `agent` > `end_user`. Enforced in two layers:
  - **DB:** RLS policies (tenant scope) + role checks for privileged tables.
  - **App:** route/server-action guards (`requireRole`).
- **Widget end-users:** may be anonymous or lightly identified; they get a
  constrained role that can only create tickets/messages and read published KB
  for their tenant — never the agent/admin surfaces.
- **Service-role key** never reaches the browser; used only in trusted jobs.

## 7. Application surfaces

| Surface           | Audience            | Notes |
| ----------------- | ------------------- | ----- |
| Admin dashboard   | tenant owner/admin/agent | Tickets, KB management, AI config, evals, analytics. |
| Support portal    | end-users           | Browse published KB, open/track tickets, chat with AI. |
| Embeddable widget | end-users on tenant site | Lightweight chat bubble; talks to AI flow; escalates to ticket. Loaded via per-tenant widget token. |
| Platform admin    | us (the SaaS vendor) | Manage tenants, plans, global health. Separate elevated surface. |

## 8. Background processing

- **Ingestion pipeline:** upload/url/manual KB → normalize → chunk → embed
  (Voyage) → upsert `kb_chunks`. Idempotent via `content_hash`.
- **Queue:** `jobs` table polled by a Vercel Cron-triggered worker route;
  retries with backoff; tenant-scoped payloads.
- **Scheduled evals & re-embeddings** on KB change or model upgrade.

## 9. Observability & audit

- `ai_interactions` is the primary AI observability + eval feedstock.
- `audit_log` records security-relevant actions (role changes, config changes,
  service-role operations).
- Per-tenant usage metering (tokens, tickets, AI answers) for billing/plans.

## 10. Main risks & mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| **Cross-tenant data leak** (the existential risk) | Catastrophic, trust-ending | RLS on every table + `force row level security`; explicit `tenant_id` filters; `withTenant` DAL; cross-tenant test suite; security-reviewer gate on any auth/tenant change. |
| **Service-role misuse bypassing RLS** | Bypasses all isolation | Service key only in vetted job code; lint rule against ad-hoc use; mandatory `tenant_id` on every op; audit-logged. |
| **Prompt injection via KB or user input** | Hijacked answers, data exfiltration | Treat all content as untrusted; delimit context; injection screening; output checks. |
| **AI hallucination / wrong answers** | Bad support, liability | Ground-only prompting + citation verification; escalate on low confidence; eval harness with false-answer-rate gate. |
| **Embedding/model drift on upgrade** | Silent quality regression | Store model+dim per chunk; eval gate before rollout; re-embed jobs. |
| **JWT claim spoofing** | Tenant takeover | Claims set server-side in `app_metadata` only; never trust client-supplied tenant id; verify signature via Supabase. |
| **Widget token abuse** | Spam/abuse, cost | Per-tenant scoped tokens, rate limiting, origin allowlist, captcha on widget. |
| **Noisy-neighbor / cost blowups** | Shared-tenancy contention | Per-tenant rate limits + usage quotas by plan; queue backpressure. |
| **Shared-schema blast radius** (migration error hits all tenants) | Wide outage | Staged migrations, backups/PITR, tested rollbacks; consider schema-per-tenant only for enterprise tier later. |
| **PII / compliance** | Legal | PII minimization, per-tenant data export/delete, region pinning if required, audit log. |

## 11. Out of scope for MVP (tracked in ROADMAP)

SSO/SAML, schema-per-tenant enterprise tier, multi-region, advanced analytics,
marketplace integrations, fine-grained custom roles. See `ROADMAP.md`.
