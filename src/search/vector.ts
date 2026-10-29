import { type ScoredId, topK } from "./bm25.js";

interface Entry {
  vector: number[];
  norm: number;
}

/** Brute-force cosine-similarity index; fine up to tens of thousands of vectors. */
export class VectorIndex {
  private readonly entries = new Map<string, Entry>();

  get size(): number {
    return this.entries.size;
  }

  add(id: string, vector: number[]): void {
    this.entries.set(id, { vector, norm: Math.hypot(...vector) });
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  search(vector: number[], k: number): ScoredId[] {
    const queryNorm = Math.hypot(...vector);
    const scores = new Map<string, number>();
    for (const [id, entry] of this.entries) {
      const denominator = queryNorm * entry.norm;
      let dot = 0;
      for (let i = 0; i < vector.length; i++) dot += (vector[i] ?? 0) * (entry.vector[i] ?? 0);
      scores.set(id, denominator === 0 ? 0 : dot / denominator);
    }
    return topK(scores, k);
  }
}
