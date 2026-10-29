import type { ScoredId } from "./bm25.js";

/** Reciprocal Rank Fusion: score(id) = sum over lists of 1 / (k + rank), rank 1-based. */
export function rrf(lists: { id: string }[][], k = 60): ScoredId[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, index) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((x, y) => y.score - x.score);
}
