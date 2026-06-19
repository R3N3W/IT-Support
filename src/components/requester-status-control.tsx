"use client";

import { useActionState } from "react";
import { requesterSetStatusAction } from "@/lib/tickets/actions";
import { type ActionState } from "@/lib/tickets/schemas";

const initial: ActionState = { error: null };

/** Lets a requester close their own ticket, or reopen it once closed. */
export function RequesterStatusControl({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    requesterSetStatusAction,
    initial,
  );
  const closing = status !== "closed";

  return (
    <form action={formAction} className="row">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="status" value={closing ? "closed" : "open"} />
      <button className="btn btn-secondary" type="submit" disabled={pending}>
        {pending ? "Updating…" : closing ? "Close ticket" : "Reopen ticket"}
      </button>
      {state.error ? <span className="error">{state.error}</span> : null}
    </form>
  );
}
