/**
 * Best-effort in-memory sliding-window limiter for the Ask-AI boundary.
 *
 * This is per server instance only. A multi-instance/serverless deployment
 * should back this with a shared store (Redis, or a Postgres rate-limit table)
 * — tracked as a follow-up. It exists so the AI entry point isn't unbounded.
 */
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 5;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): {
  ok: boolean;
  retryAfter: number;
} {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_IN_WINDOW) {
    hits.set(key, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, retryAfter };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}
