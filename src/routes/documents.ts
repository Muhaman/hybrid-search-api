import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors.js";
import type { SearchEngine } from "../search/engine.js";

const bodySchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().min(1).max(256),
        title: z.string().min(1).max(500),
        text: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(500),
});

export function documentsRouter(engine: SearchEngine): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const { documents } = bodySchema.parse(req.body);
    await engine.upsert(documents);
    res.status(202).json({ indexed: documents.length });
  });

  router.delete("/:id", (req, res) => {
    if (!engine.remove(req.params.id)) {
      throw new AppError(404, "not_found", `No document with id "${req.params.id}".`);
    }
    res.status(204).end();
  });

  return router;
}
