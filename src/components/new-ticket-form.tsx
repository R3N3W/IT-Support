"use client";

import { useActionState } from "react";
import { createTicketAction } from "@/lib/tickets/actions";
import { TICKET_PRIORITIES, type ActionState } from "@/lib/tickets/schemas";

const initial: ActionState = { error: null };

export function NewTicketForm() {
  const [state, formAction, pending] = useActionState(
    createTicketAction,
    initial,
  );

  return (
    <form action={formAction} className="stack">
      <div>
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          name="subject"
          className="input"
          required
          maxLength={200}
        />
      </div>
      <div>
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          name="priority"
          className="select"
          defaultValue="normal"
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="body">Description</label>
        <textarea id="body" name="body" className="textarea" required />
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create ticket"}
      </button>
    </form>
  );
}
