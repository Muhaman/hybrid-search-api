import { appendFile, readFile } from "node:fs/promises";
import { z } from "zod";
import { LocalEmbedder } from "../src/embed/local.js";
import { type SearchMode, SearchEngine } from "../src/search/engine.js";
import { mrr, ndcgAtK } from "./metrics.js";

const datasetSchema = z.object({
  documents: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
  queries: z.array(z.object({ q: z.string(), relevant: z.record(z.string(), z.number()) })),
});

const MODES: SearchMode[] = ["bm25", "vector", "hybrid"];
const K = 10;

const dataset = datasetSchema.parse(
  JSON.parse(await readFile(new URL("./dataset.json", import.meta.url), "utf8")),
);

const engine = new SearchEngine({ embedder: new LocalEmbedder(process.env.MODEL_CACHE_DIR ?? ".model-cache") });
await engine.upsert(dataset.documents);

const rows: string[] = [];
for (const mode of MODES) {
  let ndcgSum = 0;
  let mrrSum = 0;
  for (const { q, relevant } of dataset.queries) {
    const hits = await engine.search({ q, mode, k: K, rerank: false });
    const ranked = hits.map((hit) => hit.id);
    ndcgSum += ndcgAtK(ranked, relevant, K);
    mrrSum += mrr(ranked, new Set(Object.keys(relevant)));
  }
  const n = dataset.queries.length;
  rows.push(`| ${mode} | ${(ndcgSum / n).toFixed(3)} | ${(mrrSum / n).toFixed(3)} |`);
}

const table = [
  `Synthetic benchmark: ${dataset.documents.length} documents, ${dataset.queries.length} queries, local embeddings (Xenova/all-MiniLM-L6-v2).`,
  "",
  `| Mode | nDCG@${K} | MRR |`,
  "| --- | --- | --- |",
  ...rows,
  "",
].join("\n");

process.stdout.write(`${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Retrieval benchmark\n\n${table}\n`);
}
