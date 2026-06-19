"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMessageAction } from "@/lib/tickets/actions";
import { type ActionState } from "@/lib/tickets/schemas";

const initial: ActionState = { error: null };

export function ReplyForm({
  ticketId,
  basePath,
}: {
  ticketId: string;
  basePath: string;
}) {
  const [state, formAction, pending] = useActionState(addMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea after a successful send (no error, not pending).
  useEffect(() => {
    if (!pending && state.error === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="stack">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="basePath" value={basePath} />
      <label htmlFor="reply-body">Reply</label>
      <textarea id="reply-body" name="body" className="textarea" required />
      {state.error ? <p className="error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
