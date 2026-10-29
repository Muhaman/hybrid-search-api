/** nDCG@k with linear gain; `relevant` maps doc id to graded relevance. */
export function ndcgAtK(ranked: string[], relevant: Record<string, number>, k = 10): number {
  const dcg = ranked
    .slice(0, k)
    .reduce((sum, id, index) => sum + (relevant[id] ?? 0) / Math.log2(index + 2), 0);
  const ideal = Object.values(relevant)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, gain, index) => sum + gain / Math.log2(index + 2), 0);
  return ideal === 0 ? 0 : dcg / ideal;
}

/** Reciprocal rank of the first relevant result, 0 when none is ranked. */
export function mrr(ranked: string[], relevant: Set<string>): number {
  const index = ranked.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}
