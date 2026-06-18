# Task queue — supervised autonomous build

Ordered, small, independently verifiable tasks derived from `docs/ROADMAP.md`.
One file/feature per task. The autonomous run executes **only** `[autonomous-safe]`
tasks that the human approves below; `[needs-human]` tasks wait.

## Classification rule

A task is `[needs-human]` if it involves ANY of:
- a **product/UX decision**,
- an **external integration** (LLM/Voyage/Stripe/email/etc.),
- the **auth model** (roles, sessions, claims, policies),
- **tenant-data handling** (any table with `tenant_id`, or reads/writes of it).

Everything else — tooling, pure utilities, presentational primitives with no
data — is `[autonomous-safe]`.

> Because this is a multi-tenant SaaS, nearly all *feature* work is
> `[needs-human]` by design. The autonomous scope is the foundation those
> features assemble from. This is intentional, not a gap.

## Per-task verification

Unless noted, every task is verified by: `npm run typecheck && npm run lint &&
npm run test` all green, plus the task's own new test(s). See `CLAUDE.md` for the
full run rules (retry ≤2, skip → `REVIEW_NEEDED.md`, stop after 3 consecutive
failures, NEVER list).

## Prerequisites (human-confirmed, one-time, before launch)

- [ ] Node ≥20 + npm in the run environment. **(Currently NOT installed on this
      machine — blocks the run until resolved.)**
- [x] `git init` done; baseline committed on `main`; working branch
      `auto/overnight-2026-06-18` checked out. ✓ (2026-06-18)
- [ ] Approve the in-scope tasks (check the boxes in the table below).

---

## Queue

Legend: ☐ = approve to include in the overnight run (human ticks these).

### Group A — Tooling & quality foundation

| ID | Approve | Task | File(s) | Tag |
|----|:--:|------|---------|-----|
| T01 | ☐ | ESLint config + `lint`/`lint:fix` scripts (Next core-web-vitals + TS) | `eslint.config.mjs`, `package.json` | `[autonomous-safe]` |
| T02 | ☐ | Prettier config + ignore | `.prettierrc`, `.prettierignore` | `[autonomous-safe]` |
| T03 | ☐ | EditorConfig | `.editorconfig` | `[autonomous-safe]` |
| T04 | ☐ | Component-test harness: jsdom + @testing-library + vitest projects split (node vs jsdom) + smoke test | `vitest.config.ts`, `tests/setup-dom.ts`, `package.json` | `[autonomous-safe]` |
| T05 | ☐ | CI workflow that runs typecheck+lint+test only (NO deploy, NO migrations) | `.github/workflows/ci.yml` | `[autonomous-safe]` |

### Group B — Pure utilities & shared types (no data, no auth)

| ID | Approve | Task | File(s) | Tag |
|----|:--:|------|---------|-----|
| T06 | ☐ | `cn()` classname-merge helper + test | `src/lib/ui/cn.ts` (+ test) | `[autonomous-safe]` |
| T07 | ☐ | `slugify()` pure util + tests (used later for tenant slugs; util itself is pure) | `src/lib/utils/slug.ts` (+ test) | `[autonomous-safe]` |
| T08 | ☐ | `Result<T,E>` helper type + constructors + tests | `src/lib/utils/result.ts` (+ test) | `[autonomous-safe]` |
| T09 | ☐ | Date/relative-time formatting utils + tests | `src/lib/utils/datetime.ts` (+ test) | `[autonomous-safe]` |
| T10 | ☐ | Generic pagination zod schema (page/limit/sort) + tests — no entity fields | `src/lib/validation/pagination.ts` (+ test) | `[autonomous-safe]` |
| T11 | ☐ | Typed app error classes (AppError/NotFound/Conflict/Validation) + tests. **Definitions only — no wiring into auth/session.** | `src/lib/errors.ts` (+ test) | `[autonomous-safe]` |

### Group C — Presentational UI primitives (props-only, no data fetching)

Depends on T04 (component-test harness) and T06 (`cn`).

| ID | Approve | Task | File(s) | Tag |
|----|:--:|------|---------|-----|
| T12 | ☐ | `Button` (variants/sizes/disabled/loading) + test | `src/components/ui/button.tsx` (+ test) | `[autonomous-safe]` |
| T13 | ☐ | `Badge` / status pill (generic color prop) + test | `src/components/ui/badge.tsx` (+ test) | `[autonomous-safe]` |
| T14 | ☐ | `Spinner` + test | `src/components/ui/spinner.tsx` (+ test) | `[autonomous-safe]` |
| T15 | ☐ | `EmptyState` (icon/title/description/action slot) + test | `src/components/ui/empty-state.tsx` (+ test) | `[autonomous-safe]` |
| T16 | ☐ | `Card` (header/body/footer) + test | `src/components/ui/card.tsx` (+ test) | `[autonomous-safe]` |
| T17 | ☐ | Design tokens + global stylesheet (CSS variables, no branding decisions) | `src/app/globals.css` | `[autonomous-safe]` |
| T18 | ☐ | CONTRIBUTING / local-dev guide doc | `docs/CONTRIBUTING.md` | `[autonomous-safe]` |

### Group D — Phase 2: ticketing MVP (all tenant data / UX → human)

| ID | Approve | Task | File(s) | Tag |
|----|:--:|------|---------|-----|
| D19 | — | `tickets` + `ticket_messages` schema, indexes, **force RLS + full policy set** | migration | `[needs-human]` (tenant data + migration) |
| D20 | — | Ticket DAL + server actions (create/assign/status/reply) | `src/lib/...` | `[needs-human]` (tenant data, auth) |
| D21 | — | Admin ticket list + detail/thread UI (wired to data) | `src/app/admin/...` | `[needs-human]` (tenant data, UX) |
| D22 | — | End-user portal: create + track tickets | `src/app/portal/...` | `[needs-human]` (tenant data, UX) |
| D23 | — | Cross-tenant isolation tests for tickets/messages | `tests/isolation/...` | `[needs-human]` (tenant data) |

### Group E–I — Phases 3–7 (tenant data + external integrations + decisions → human)

| ID | Approve | Task | Tag |
|----|:--:|------|-----|
| E24 | — | KB tables (`kb_articles`, `kb_chunks`+vector) + force RLS | `[needs-human]` (tenant data) |
| E25 | — | KB CRUD UI + DAL (publish/draft/archive) | `[needs-human]` (tenant data, UX) |
| E26 | — | Ingestion → chunk → **embed (Voyage)** pipeline + jobs queue | `[needs-human]` (external integration, tenant data) |
| F27 | — | RAG retrieval + per-tenant prompt + **Claude** generation + escalation gate | `[needs-human]` (external integration, tenant data, product) |
| F28 | — | `ai_interactions` logging + confidence handling | `[needs-human]` (tenant data) |
| G29 | — | Eval harness (`eval_*` tables, runner, metrics, LLM-judge) | `[needs-human]` (external integration, tenant data) |
| H30 | — | Embeddable widget + per-tenant widget token (origin allowlist, rate limit) | `[needs-human]` (auth model, tenant data) |
| I31 | — | Plans + usage metering + **billing (Stripe)** | `[needs-human]` (external integration, product) |

---

## Summary

- `[autonomous-safe]` (overnight-eligible, pending approval): **T01–T18** (18 tasks).
- `[needs-human]`: **D19–I31** (13 tasks) — run only with you supervising.

Tick the ☐ boxes for the autonomous tasks you want in scope, confirm the
prerequisites, and I'll prepare the launch.
