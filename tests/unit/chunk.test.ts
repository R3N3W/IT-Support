import { describe, it, expect } from "vitest";
import { chunkText, estimateTokens } from "@/lib/ai/chunk";

describe("chunkText", () => {
  it("returns nothing for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps a short document as one chunk indexed from 0", () => {
    const chunks = chunkText("Hello world.\n\nSecond paragraph.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toContain("Hello world");
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("splits long content into multiple, sequentially indexed chunks", () => {
    const para = "x".repeat(1400);
    const doc = Array.from({ length: 5 }, (_, i) => `Para ${i} ${para}`).join(
      "\n\n",
    );
    const chunks = chunkText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("hard-splits a single oversized paragraph", () => {
    const chunks = chunkText("y".repeat(5000));
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("estimateTokens", () => {
  it("scales roughly with length", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
});
