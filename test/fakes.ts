import { pino } from "pino";
import type { AppDeps } from "../src/app.js";
import type { Embedder } from "../src/embed/embedder.js";
import type { Reranker } from "../src/rerank.js";
import { SearchEngine } from "../src/search/engine.js";

const DIM = 16;

/** Deterministic bag-of-characters embedder: similar text yields similar vectors. */
export class FakeEmbedder implements Embedder {
  readonly dim = DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = new Array<number>(DIM).fill(0);
      for (const char of text.toLowerCase()) {
        const slot = char.charCodeAt(0) % DIM;
        vector[slot] = (vector[slot] ?? 0) + 1;
      }
      const norm = Math.hypot(...vector) || 1;
      return vector.map((v) => v / norm);
    });
  }
}

/** Scores documents by the position of their id in a fixed preference list. */
export class FakeReranker implements Reranker {
  constructor(private readonly preferred: string[]) {}

  async rerank(_query: string, docs: { id: string; text: string }[]) {
    return docs.map((doc) => ({
      id: doc.id,
      score: Math.max(0, 3 - this.preferred.indexOf(doc.id)),
    }));
  }
}

export function makeDeps(reranker?: Reranker): AppDeps {
  return {
    engine: new SearchEngine({ embedder: new FakeEmbedder(), reranker }),
    corsOrigins: ["http://localhost:5173"],
    logger: pino({ level: "silent" }),
  };
}
