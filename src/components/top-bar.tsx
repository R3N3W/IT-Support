import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import type { TenantContext } from "@/lib/auth/session";

export function TopBar({ ctx, home }: { ctx: TenantContext; home: string }) {
  return (
    <div className="topbar">
      <Link href={home} style={{ fontWeight: 500, textDecoration: "none" }}>
        IT Support
      </Link>
      <div className="row">
        <span className="muted">
          {ctx.email} · {ctx.role}
        </span>
        <form action={signOut}>
          <button className="btn btn-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
