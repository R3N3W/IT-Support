# IT Support SaaS (multi-tenant)

A turnkey, multi-tenant SaaS for small companies. Each **tenant** (client
company) gets a ticketing system, an end-user support portal/widget, an admin
dashboard, and an **AI support agent** that answers from *that tenant's own
knowledge base* (RAG) and escalates to a human when unsure.

> **Status: Phase 1 — design & scaffold only.** No feature code yet.
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
> [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

- **App:** Next.js (App Router, TypeScript) on **Vercel**
- **Data:** **Supabase** Postgres + `pgvector` (vectors in the same DB)
- **Auth:** Supabase Auth (JWT carries `tenant_id` + `role` claims)
- **AI:** Anthropic **Claude** (`claude-sonnet-4-6`) for answers; **Voyage AI**
  for embeddings
- **Isolation:** shared schema + Postgres **Row-Level Security**, `tenant_id` on
  every tenant-scoped row

## The non-negotiable: tenant isolation

No query, embedding search, AI answer, or ticket may ever cross a tenant
boundary. Isolation is enforced **in the database** via RLS (`force row level
security` on every tenant table), with explicit `tenant_id` predicates in app
code as defense in depth. Any change touching auth, payments, or tenant data
goes through a `security-reviewer` pass before commit.

## Repository layout

```
docs/                 Architecture & roadmap (source of truth)
.claude/agents/       Specialized subagents (see below)
src/
  app/                Next.js routes — admin dashboard, portal, widget, api
  components/         Shared UI
  lib/                Server libs: db (withTenant DAL), auth, ai (RAG/eval)
  types/              Shared TypeScript types
supabase/
  migrations/         SQL migrations (schema + RLS)
tests/
  isolation/          Cross-tenant isolation suite (critical)
  unit/  integration/ Other tests
```

## Subagents

Defined in [`.claude/agents/`](.claude/agents). Delegation is description-driven:

| Agent | Role |
| ----- | ---- |
| `solution-architect` | Owns the spec/architecture (read + docs only). |
| `backend-engineer` | API, ticketing, auth, tenant isolation, DB/RLS. |
| `frontend-engineer` | Admin dashboard + end-user portal/widget. |
| `ai-support-engineer` | RAG, per-tenant config, escalation, eval harness. |
| `qa-test-engineer` | Test suites + edge cases (isolation-first). |
| `security-reviewer` | Read-only; runs before commits to auth/payments/tenant data. |

## Getting started (later phases)

```bash
cp .env.example .env.local   # fill in Supabase + AI keys
npm install                  # deps added per phase
npm run dev
```

## Development workflow

1. Build per `docs/ROADMAP.md` (MVP first).
2. Write tests with every feature; keep the isolation suite green.
3. Run `security-reviewer` before committing auth/payments/tenant-data changes.
4. Keep `docs/ARCHITECTURE.md` in sync with decisions.
