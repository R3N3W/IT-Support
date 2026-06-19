import { describe, it, expect } from "vitest";
import {
  getEmbeddingsProvider,
  toVectorLiteral,
  EMBEDDING_DIM,
} from "@/lib/ai/embeddings";

// With no VOYAGE_API_KEY set (the default in .env.local), this is the stub.
describe("embeddings provider (stub)", () => {
  it("produces deterministic vectors of the configured dimension", async () => {
    const provider = getEmbeddingsProvider();
    const [a] = await provider.embed(["hello"]);
    const [b] = await provider.embed(["hello"]);
    const [c] = await provider.embed(["different text"]);

    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(a).toEqual(b); // deterministic for identical input
    expect(a).not.toEqual(c); // different input → different vector
  });

  it("returns one ~unit-norm vector per input", async () => {
    const provider = getEmbeddingsProvider();
    const vecs = await provider.embed(["one", "two", "three"]);
    expect(vecs).toHaveLength(3);
    const norm = Math.sqrt(vecs[0].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("serializes vectors to a pgvector literal", () => {
    expect(toVectorLiteral([1, 2, 3])).toBe("[1,2,3]");
  });
});
