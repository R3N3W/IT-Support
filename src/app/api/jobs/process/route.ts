import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/jobs/queue";

// Runs the background job worker (KB embedding). Invoked by Vercel Cron on a
// schedule (see vercel.json). Protected by CRON_SECRET: Vercel sends it as a
// Bearer token. Fails closed if the secret is unset.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueJobs();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "worker error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
