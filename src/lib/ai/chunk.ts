/**
 * Split markdown/plain text into retrieval-sized chunks. Packs paragraphs up to
 * a target size with a small overlap so context isn't lost at boundaries, and
 * hard-splits any single oversized paragraph.
 */
export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
}

const TARGET_CHARS = 1500;
const OVERLAP_CHARS = 200;

/** Rough token estimate (~4 chars/token). Good enough for sizing/metrics. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const packed: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf && buf.length + 2 + p.length > TARGET_CHARS) {
      packed.push(buf);
      const overlap = buf.slice(Math.max(0, buf.length - OVERLAP_CHARS));
      buf = `${overlap}\n\n${p}`;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) packed.push(buf);

  const chunks: Chunk[] = [];
  let index = 0;
  for (const piece of packed) {
    if (piece.length <= TARGET_CHARS * 1.5) {
      chunks.push({ index: index++, content: piece, tokenCount: estimateTokens(piece) });
    } else {
      // Single huge paragraph: hard-split into fixed-size windows.
      for (let i = 0; i < piece.length; i += TARGET_CHARS) {
        const part = piece.slice(i, i + TARGET_CHARS);
        chunks.push({
          index: index++,
          content: part,
          tokenCount: estimateTokens(part),
        });
      }
    }
  }
  return chunks;
}
