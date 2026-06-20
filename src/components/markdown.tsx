import ReactMarkdown from "react-markdown";

/**
 * Safe markdown renderer. react-markdown does not render raw HTML and sanitizes
 * dangerous URLs by default, so agent-authored KB content cannot inject script.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
