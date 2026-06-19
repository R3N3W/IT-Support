# Roadmap — Multi-Tenant IT Support SaaS

Phased build plan. **MVP first**, then layers. Each phase ends with a working,
deployable, tested increment. Security review is mandatory on any phase touching
auth, payments, or tenant data.

Legend: 🔒 = `security-reviewer` gate required before merge.

---

## Phase 0 — Foundation (this Phase 1 deliverable)

Goal: agreed architecture, repo scaffold, agents, conventions. **No feature
code.**

- [x] Decisions: Supabase + Vercel, shared-schema + RLS, Claude + Voyage,
      Supabase Auth.
- [x] `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.
- [x] Subagents in `.claude/agents/`.
- [x] Repo scaffold (folders, package setup, `.gitignore`, `README`).

Exit: docs + scaffold reviewed and approved.

---

## Phase 1 — Tenant & auth core 🔒

Goal: a tenant can exist, users can sign in, and isolation is provably enforced.

- Supabase project + migrations: `tenants`, `users`, base RLS policies,
  `force row level security` everywhere.
- Tenant provisioning flow (create tenant + owner; set `tenant_id`/`role` in
  `app_metadata`).
- Supabase Auth wired into Next.js (server session, `requireRole`,
  `withTenant` DAL).
- **Cross-tenant isolation test suite** (two-tenant fixture; A cannot touch B).

Exit: green isolation suite; you can log in as tenant A admin and see only A.

---

## Phase 2 — Ticketing MVP 🔒

Goal: end-to-end human ticketing without AI yet.

- `tickets`, `ticket_messages` tables + RLS.
- Admin dashboard: ticket list, detail/thread, assign, status changes.
- End-user portal: create ticket, view own tickets, reply.
- Email-in is stubbed; `channel` recorded.

Exit: an end-user opens a ticket; an agent in the same tenant resolves it.

**Status (2026-06-19): COMPLETE & VERIFIED.** Data layer (tables, role-aware
RLS, composite FKs, immutable-column trigger, DAL + service, isolation suite)
shipped and security-reviewed; UI vertical (login, admin dashboard, end-user
portal) shipped and build-verified. All 17 cross-tenant + role isolation tests
pass live, and a full browser smoke passed end to end: end-user logged in →
filed a ticket → agent logged in → saw it in the queue → replied → assigned →
resolved (confirmed in the DB). Email-in deferred to a later phase.

---

## Phase 3 — Knowledge base + ingestion 🔒

Goal: per-tenant KB content ready for retrieval.

- `kb_articles`, `kb_chunks` (+ `pgvector`, indexes) + RLS.
- Admin KB CRUD (markdown), publish/draft/archive.
- Ingestion pipeline: chunk → embed (Voyage) → upsert; `content_hash` dedupe.
- `jobs` queue + Vercel Cron worker for async embedding.

Exit: publish an article; chunks + embeddings appear, tenant-scoped.

---

## Phase 4 — AI support agent (RAG + escalation) 🔒

Goal: the core differentiator.

- RAG retrieval (tenant-scoped, top-k, similarity floor).
- Prompt composition: platform base + tenant `system_prompt` overlay.
- Claude generation with ground-only + citation instructions.
- Confidence/escalation gate → create `escalation` + ticket; notify agents.
- `ai_interactions` logging.
- Prompt-injection screening on input + retrieved context.

Exit: a KB-answerable question is answered with citations; an unanswerable one
escalates to a human ticket.

---

## Phase 5 — Eval harness 🔒

Goal: measure and gate AI quality per tenant.

- `eval_cases`, `eval_runs`, `eval_results` + RLS.
- Runner over full RAG flow against a config snapshot.
- Metrics: groundedness (LLM-as-judge), retrieval hit-rate,
  correct-escalation rate, false-answer rate, latency, cost.
- Gate config/prompt changes; scheduled runs on KB change.

Exit: changing a tenant's prompt produces a comparable eval report; regressions
are visible and blockable.

---

## Phase 6 — Embeddable widget 🔒

Goal: drop-in chat on the tenant's own site.

- Per-tenant widget token (scoped, origin-allowlisted, rate-limited).
- Lightweight embeddable chat bubble → AI flow → ticket escalation.
- Constrained anonymous/end-user role.

Exit: paste a snippet on an external page; chat works and stays tenant-isolated.

---

## Phase 7 — Admin polish, analytics, billing

Goal: sellable product.

- Tenant AI config UI (system prompt, thresholds, policy, branding).
- Analytics: deflection rate, escalation rate, CSAT, usage.
- Plans + usage metering + billing (Stripe). 🔒
- Platform-admin surface (manage tenants/plans/health).

Exit: a new tenant can self-onboard, configure, and be billed.

---

## Phase 8 — Hardening & scale

- Rate limiting, abuse/captcha on widget, per-tenant quotas.
- Backups/PITR, staged migrations, runbooks.
- Performance: vector index tuning, caching.
- Enterprise options (SSO/SAML, schema-per-tenant tier, region pinning) —
  scoped as needed.

---

## Cross-cutting (every phase)

- Tests with each feature (unit + integration + isolation). `qa-test-engineer`.
- 🔒 `security-reviewer` before merging auth/payments/tenant-data changes.
- Keep `ARCHITECTURE.md` in sync; `solution-architect` owns the spec.

### Tenant-table discipline (non-negotiable, every new tenant-scoped table)

Adding any tenant-scoped table (`tickets`, `kb_chunks`, `ai_interactions`, …)
is the #1 leak vector. Every such table MUST, in the same migration:

1. Have `tenant_id uuid not null` (FK to `tenants`) and a `tenant_id`-leading index.
2. `enable` **and** `force row level security`.
3. Get the full policy set: `select`/`insert`/`update`/`delete`, with a
   `with check (tenant_id = app.current_tenant_id())` on insert/update so a row
   can never be written into another tenant. Write policies that mutate
   privilege columns (e.g. `role`) must also enforce role-rank checks and forbid
   self-escalation.
4. Be added to `TenantScopedTable` in `src/lib/db/with-tenant.ts`.
5. Get a row in the cross-tenant isolation suite.

Planned guard: a CI check that fails if any `public.*` table lacks
`force row level security`.
