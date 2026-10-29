import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { errorHandler } from "./errors.js";
import type { Logger } from "./logger.js";
import { documentsRouter } from "./routes/documents.js";
import { searchRouter } from "./routes/search.js";
import type { SearchEngine } from "./search/engine.js";

export interface AppDeps {
  engine: SearchEngine;
  corsOrigins: string[];
  logger: Logger;
  /** Requests allowed per client per minute; defaults to 120. */
  rateLimitPerMinute?: number;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const incoming = req.header("x-request-id");
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    res.setHeader("x-request-id", requestId);
    const startedAt = Date.now();
    res.on("finish", () => {
      deps.logger.info(
        { requestId, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - startedAt },
        "request",
      );
    });
    next();
  });

  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigins }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: deps.rateLimitPerMinute ?? 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: { code: "rate_limited", message: "Too many requests." } });
      },
    }),
  );

  app.use("/v1/documents", express.json({ limit: "10mb" }), documentsRouter(deps.engine));
  app.use("/v1/search", searchRouter(deps.engine));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });
  app.use(errorHandler(deps.logger));
  return app;
}
