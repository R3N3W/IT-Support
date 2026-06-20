"use client";

import { useState } from "react";
import Link from "next/link";
import type { KbArticle } from "@/types/database";

const STATUS_FILTERS = ["all", "draft", "published", "archived"] as const;

export function KbArticleList({ articles }: { articles: KbArticle[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const needle = query.trim().toLowerCase();
  const filtered = articles.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      a.title.toLowerCase().includes(needle),
  );

  return (
    <div className="stack">
      <div className="row">
        <input
          className="input"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
          aria-label="Search articles"
        />
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: 160 }}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No matching articles.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/kb/${a.id}`}>{a.title}</Link>
                </td>
                <td>
                  <span className="badge">{a.status}</span>
                </td>
                <td className="muted">
                  {new Date(a.updated_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
