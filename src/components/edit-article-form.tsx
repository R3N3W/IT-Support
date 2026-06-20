"use client";

import { useActionState } from "react";
import { updateArticleAction } from "@/lib/kb/actions";
import { type ActionState } from "@/lib/forms";

const initial: ActionState = { error: null };

export function EditArticleForm({
  articleId,
  title,
  body,
}: {
  articleId: string;
  title: string;
  body: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateArticleAction,
    initial,
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="articleId" value={articleId} />
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          className="input"
          required
          maxLength={200}
          defaultValue={title}
        />
      </div>
      <div>
        <label htmlFor="body">Body (markdown)</label>
        <textarea
          id="body"
          name="body"
          className="textarea"
          style={{ minHeight: 280 }}
          defaultValue={body}
        />
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
