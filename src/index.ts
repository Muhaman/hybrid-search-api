import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { createApp } from "./app.js";
import { LocalEmbedder } from "./embed/local.js";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { ClaudeReranker } from "./rerank.js";
import { SearchEngine } from "./search/engine.js";
import { loadSnapshot, SnapshotWriter } from "./search/snapshot.js";

config({ quiet: true });

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);

const reranker = env.ANTHROPIC_API_KEY
  ? new ClaudeReranker(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), env.RERANK_MODEL)
  : undefined;
if (!reranker) logger.warn("ANTHROPIC_API_KEY not set: rerank=true requests will be rejected");

const writer: SnapshotWriter = new SnapshotWriter(env.SNAPSHOT_PATH, () => engine.snapshot(), logger);
const engine: SearchEngine = new SearchEngine({
  embedder: new LocalEmbedder(env.MODEL_CACHE_DIR),
  reranker,
  onChange: () => writer.schedule(),
});

const snapshot = await loadSnapshot(env.SNAPSHOT_PATH);
if (snapshot) {
  engine.restore(snapshot);
  logger.info({ documents: engine.size }, "snapshot restored");
}

const app = createApp({ engine, corsOrigins: env.corsOrigins, logger });
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "server listening"));

function shutdown(): void {
  server.close(() => {
    void writer.flush().finally(() => process.exit(0));
  });
  server.closeAllConnections();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
