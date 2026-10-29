import { Router } from "express";
import { z } from "zod";
import type { SearchEngine } from "../search/engine.js";

const querySchema = z.object({
  q: z.string().min(1).max(500),
  mode: z.enum(["bm25", "vector", "hybrid"]).default("hybrid"),
  k: z.coerce.number().int().min(1).max(50).default(10),
  rerank: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export function searchRouter(engine: SearchEngine): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const params = querySchema.parse(req.query);
    res.json({ results: await engine.search(params) });
  });

  return router;
}
