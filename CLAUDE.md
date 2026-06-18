# CLAUDE.md — project + agent operating rules

Multi-tenant IT support SaaS. Stack: Next.js (App Router, TS) on Vercel,
Supabase (Postgres + pgvector + Auth + Storage), Claude + Voyage for the AI
agent. Isolation: shared schema + Postgres RLS, `tenant_id` on every
tenant-scoped row. Source of truth: `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`.

Every new tenant-scoped table follows the discipline in
`docs/ROADMAP.md` → "Tenant-table discipline" (force RLS + full policy set +
isolation test + `TenantScopedTable` entry). No exceptions.

---

## Autonomous / overnight run rules (apply to ALL agents)

These govern any unattended or autonomous run. They override convenience.

### Scope
- Run ONLY tasks marked `[autonomous-safe]` in `docs/TASK_QUEUE.md` **that the
  human has explicitly approved for the run**. Never run a `[needs-human]` task
  unattended. Never invent tasks not in the approved queue.

### Per-task loop
1. Implement exactly one task (one file/feature).
2. Run, in order: `npm run typecheck`, `npm run lint`, `npm run test`.
3. **Proceed only if all three pass.**
   - On green: `git commit` with a clear, specific message (what + why).
     Commit to the run's working branch — never to `main`.
   - On red: retry the task at most **twice** (3 attempts total). If still red,
     **skip** it and append an entry to `docs/REVIEW_NEEDED.md` containing the
     task id, what was attempted, and the full error output. Revert/clean any
     partial changes from the failed task before moving on.

### Hard stops
- Stop the ENTIRE run if **3 consecutive tasks fail** (regardless of skips).
- Stop if a task would require any NEVER action below.

### NEVER (no exceptions, even if a task seems to ask for it)
- Deploy (Vercel or anywhere).
- Run migrations against a real/remote database, or otherwise mutate live data.
- Read, write, or modify secrets or any `.env*` file.
- Push to `main` (or force-push anywhere). Local commits on the working branch
  only; do not push unless a human is supervising.
- Publish packages (no `npm publish`).
- Delete data (DB rows, storage objects) or destructive file ops outside the
  task's own scratch.

### Logging
- Keep `docs/REVIEW_NEEDED.md` current for every skip.
- At end of run, fill in `docs/MORNING_REPORT.md` from its template.

### Prerequisites the human must confirm before launching
- Node ≥20 + npm available in the run environment (checks depend on it).
- Git repo initialized and a dedicated working branch checked out.
- `eslint` configured (task T01) so `npm run lint` is real, not a stub.
