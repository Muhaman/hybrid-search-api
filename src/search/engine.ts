import type { Embedder } from "../embed/embedder.js";
import { AppError } from "../errors.js";
import type { Reranker } from "../rerank.js";
import { Bm25Index, type ScoredId } from "./bm25.js";
import { rrf } from "./fusion.js";
import type { Snapshot } from "./snapshot.js";
import { VectorIndex } from "./vector.js";

export type SearchMode = "bm25" | "vector" | "hybrid";

export interface SearchParams {
  q: string;
  mode: SearchMode;
  k: number;
  rerank: boolean;
}

export interface IndexDocument {
  id: string;
  title: string;
  text: string;
}

export interface Hit {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface EngineOptions {
  embedder: Embedder;
  reranker?: Reranker | undefined;
  /** Called after every mutation; used to schedule snapshot writes. */
  onChange?: (() => void) | undefined;
}

const CANDIDATE_DEPTH = 50;
const RERANK_DEPTH = 20;
const EMBED_BATCH = 32;
const SNIPPET_CHARS = 160;

interface StoredDocument extends IndexDocument {
  vector: number[];
}

export class SearchEngine {
  private readonly docs = new Map<string, StoredDocument>();
  private readonly bm25 = new Bm25Index();
  private readonly vectors = new VectorIndex();

  constructor(private readonly options: EngineOptions) {}

  get size(): number {
    return this.docs.size;
  }

  async upsert(documents: IndexDocument[]): Promise<void> {
    const texts = documents.map(indexText);
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      vectors.push(...(await this.options.embedder.embed(texts.slice(i, i + EMBED_BATCH))));
    }
    documents.forEach((doc, i) => this.insert({ ...doc, vector: vectors[i] ?? [] }));
    this.options.onChange?.();
  }

  remove(id: string): boolean {
    if (!this.docs.delete(id)) return false;
    this.bm25.remove(id);
    this.vectors.remove(id);
    this.options.onChange?.();
    return true;
  }

  restore(snapshot: Snapshot): void {
    for (const doc of snapshot.documents) this.insert(doc);
  }

  snapshot(): Snapshot {
    return { version: 1, documents: [...this.docs.values()] };
  }

  async search({ q, mode, k, rerank }: SearchParams): Promise<Hit[]> {
    if (rerank && !this.options.reranker) {
      throw new AppError(400, "rerank_unavailable", "Reranking requires ANTHROPIC_API_KEY to be configured.");
    }
    if (this.docs.size === 0) return [];

    let ranked = await this.retrieve(q, mode, Math.max(k, CANDIDATE_DEPTH));
    if (rerank && this.options.reranker) {
      ranked = await this.rerankTop(this.options.reranker, q, ranked.slice(0, RERANK_DEPTH));
    }
    return ranked.slice(0, k).flatMap(({ id, score }) => {
      const doc = this.docs.get(id);
      return doc ? [{ id, title: doc.title, snippet: snippet(doc.text), score }] : [];
    });
  }

  private insert(doc: StoredDocument): void {
    this.docs.set(doc.id, doc);
    this.bm25.add(doc.id, indexText(doc));
    this.vectors.add(doc.id, doc.vector);
  }

  private async retrieve(q: string, mode: SearchMode, depth: number): Promise<ScoredId[]> {
    if (mode === "bm25") return this.bm25.search(q, depth);
    const [vector] = await this.options.embedder.embed([q]);
    const semantic = this.vectors.search(vector ?? [], depth);
    if (mode === "vector") return semantic;
    return rrf([this.bm25.search(q, depth), semantic]);
  }

  /** Reorders candidates by reranker relevance; ties keep their retrieval order. */
  private async rerankTop(reranker: Reranker, q: string, candidates: ScoredId[]): Promise<ScoredId[]> {
    const texts = candidates.flatMap(({ id }) => {
      const doc = this.docs.get(id);
      return doc ? [{ id, text: indexText(doc) }] : [];
    });
    if (texts.length === 0) return [];
    const relevance = new Map((await reranker.rerank(q, texts)).map(({ id, score }) => [id, score]));
    return candidates
      .map(({ id }, position) => ({ id, score: relevance.get(id) ?? 0, position }))
      .sort((x, y) => y.score - x.score || x.position - y.position)
      .map(({ id, score }) => ({ id, score }));
  }
}

function indexText(doc: IndexDocument): string {
  return `${doc.title}. ${doc.text}`;
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_CHARS ? `${flat.slice(0, SNIPPET_CHARS).trimEnd()}…` : flat;
}
