"use client";

import { useActionState } from "react";
import { createArticleAction } from "@/lib/kb/actions";
import { type ActionState } from "@/lib/forms";

const initial: ActionState = { error: null };

export function NewArticleForm() {
  const [state, formAction, pending] = useActionState(
    createArticleAction,
    initial,
  );

  return (
    <form action={formAction} className="stack">
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          className="input"
          required
          maxLength={200}
        />
      </div>
      <div>
        <label htmlFor="body">Body (markdown)</label>
        <textarea
          id="body"
          name="body"
          className="textarea"
          style={{ minHeight: 220 }}
        />
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
