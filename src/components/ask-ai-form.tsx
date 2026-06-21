"use client";

import { useActionState } from "react";
import Link from "next/link";
import { askAction } from "@/lib/ai/actions";
import { type AskState } from "@/lib/ai/ask-state";

const initial: AskState = { status: "idle" };

export function AskAiForm() {
  const [state, formAction, pending] = useActionState(askAction, initial);

  const articleIds =
    state.status === "answered"
      ? Array.from(new Set(state.citations.map((c) => c.articleId)))
      : [];

  return (
    <div className="stack">
      <form action={formAction} className="stack">
        <label htmlFor="question">Ask a question</label>
        <textarea
          id="question"
          name="question"
          className="textarea"
          required
          maxLength={2000}
          placeholder="e.g. How do I connect to the VPN?"
        />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {state.status === "error" ? <p className="error">{state.error}</p> : null}

      {state.status === "answered" ? (
        <div className="card stack">
          <div style={{ whiteSpace: "pre-wrap" }}>{state.answer}</div>
          {articleIds.length > 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Sources:{" "}
              {articleIds.map((id, i) => (
                <span key={id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/portal/kb/${id}`}>article {i + 1}</Link>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.status === "escalated" ? (
        <div className="card stack">
          <p>
            We could not answer this automatically, so we have opened a ticket
            for a human agent.
          </p>
          {state.ticketId ? (
            <Link
              className="btn btn-secondary"
              href={`/portal/tickets/${state.ticketId}`}
            >
              View your ticket
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
