/**
 * Embeddings provider behind a small interface so the ingestion pipeline does
 * not depend on a specific vendor. If VOYAGE_API_KEY is set we use Voyage;
 * otherwise a deterministic stub is used so the whole pipeline (and its tests)
 * runs without any key. The stub is NOT suitable for real retrieval quality.
 */
export const EMBEDDING_MODEL = "voyage-3";
export const EMBEDDING_DIM = 1024;

export interface EmbeddingsProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Deterministic, normalized pseudo-vectors seeded from the text. */
function stubVector(text: string, dim: number): number[] {
  let h = 2166136261 >>> 0; // FNV-1a seed
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h || 1;
  const v = new Array<number>(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    // LCG step — deterministic given the seed.
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const x = (state / 0xffffffff) * 2 - 1;
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

class StubEmbeddingsProvider implements EmbeddingsProvider {
  readonly model = "stub-1024";
  readonly dimensions = EMBEDDING_DIM;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => stubVector(t, this.dimensions));
  }
}

class VoyageEmbeddingsProvider implements EmbeddingsProvider {
  readonly dimensions = EMBEDDING_DIM;
  constructor(
    private readonly apiKey: string,
    readonly model: string = EMBEDDING_MODEL,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) {
      throw new Error(
        `Voyage embeddings failed: ${res.status} ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

let cached: EmbeddingsProvider | null = null;

export function getEmbeddingsProvider(): EmbeddingsProvider {
  if (cached) return cached;
  const key = process.env.VOYAGE_API_KEY;
  cached = key
    ? new VoyageEmbeddingsProvider(
        key,
        process.env.VOYAGE_EMBED_MODEL || EMBEDDING_MODEL,
      )
    : new StubEmbeddingsProvider();
  return cached;
}

/** Serialize a vector to the pgvector text literal supabase-js expects. */
export function toVectorLiteral(vector: number[]): string {
  return JSON.stringify(vector);
}
