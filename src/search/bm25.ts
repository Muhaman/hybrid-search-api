import { tokenize } from "../text/tokenize.js";

export interface ScoredId {
  id: string;
  score: number;
}

interface DocStats {
  terms: string[];
  length: number;
}

/** Okapi BM25 over an inverted index; postings map term -> (doc id -> term frequency). */
export class Bm25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly postings = new Map<string, Map<string, number>>();
  private readonly docs = new Map<string, DocStats>();
  private totalLength = 0;

  constructor({ k1 = 1.2, b = 0.75 }: { k1?: number; b?: number } = {}) {
    this.k1 = k1;
    this.b = b;
  }

  get size(): number {
    return this.docs.size;
  }

  add(id: string, text: string): void {
    this.remove(id);
    const tokens = tokenize(text);
    const frequencies = new Map<string, number>();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    for (const [term, tf] of frequencies) {
      let posting = this.postings.get(term);
      if (!posting) {
        posting = new Map();
        this.postings.set(term, posting);
      }
      posting.set(id, tf);
    }
    this.docs.set(id, { terms: [...frequencies.keys()], length: tokens.length });
    this.totalLength += tokens.length;
  }

  remove(id: string): void {
    const doc = this.docs.get(id);
    if (!doc) return;
    for (const term of doc.terms) {
      const posting = this.postings.get(term);
      posting?.delete(id);
      if (posting?.size === 0) this.postings.delete(term);
    }
    this.totalLength -= doc.length;
    this.docs.delete(id);
  }

  idf(term: string): number {
    const n = this.postings.get(term)?.size ?? 0;
    return Math.log(1 + (this.docs.size - n + 0.5) / (n + 0.5));
  }

  search(query: string, k: number): ScoredId[] {
    if (this.docs.size === 0) return [];
    const avgLength = this.totalLength / this.docs.size || 1;
    const scores = new Map<string, number>();
    for (const term of new Set(tokenize(query))) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      const idf = this.idf(term);
      for (const [id, tf] of posting) {
        const length = this.docs.get(id)?.length ?? 0;
        const norm = tf + this.k1 * (1 - this.b + (this.b * length) / avgLength);
        scores.set(id, (scores.get(id) ?? 0) + (idf * tf * (this.k1 + 1)) / norm);
      }
    }
    return topK(scores, k);
  }
}

export function topK(scores: Map<string, number>, k: number): ScoredId[] {
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
    .slice(0, k);
}
