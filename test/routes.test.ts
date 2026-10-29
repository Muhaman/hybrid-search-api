import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeReranker, makeDeps } from "./fakes.js";

const DOCS = [
  { id: "a", title: "Sourdough", text: "Feeding a sourdough starter with flour and water." },
  { id: "b", title: "Espresso", text: "Grind size controls espresso extraction." },
  { id: "c", title: "Tomatoes", text: "Water tomato plants at the base of the stem." },
];

async function seeded(reranker?: FakeReranker) {
  const app = createApp(makeDeps(reranker));
  const res = await request(app).post("/v1/documents").send({ documents: DOCS });
  expect(res.status).toBe(202);
  return app;
}

describe("GET /v1/search", () => {
  it("returns an empty result list for an empty index", async () => {
    const res = await request(createApp(makeDeps())).get("/v1/search").query({ q: "anything" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it("returns 400 when q is missing", async () => {
    const res = await request(createApp(makeDeps())).get("/v1/search");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
  });

  it("returns 400 when k is above 50", async () => {
    const res = await request(createApp(makeDeps())).get("/v1/search").query({ q: "x", k: 100 });
    expect(res.status).toBe(400);
  });

  it("finds documents in every mode", async () => {
    const app = await seeded();
    for (const mode of ["bm25", "vector", "hybrid"]) {
      const res = await request(app).get("/v1/search").query({ q: "espresso grind", mode });
      expect(res.status).toBe(200);
      expect(res.body.results[0]).toMatchObject({ id: "b", title: "Espresso" });
      expect(res.body.results[0].snippet).toContain("espresso");
    }
  });

  it("limits results to k", async () => {
    const app = await seeded();
    const res = await request(app).get("/v1/search").query({ q: "water", mode: "vector", k: 2 });
    expect(res.body.results).toHaveLength(2);
  });

  it("orders results by the reranker when rerank=true", async () => {
    const app = await seeded(new FakeReranker(["c", "a", "b"]));
    const res = await request(app).get("/v1/search").query({ q: "water", mode: "vector", rerank: "true" });
    expect(res.status).toBe(200);
    expect(res.body.results.map((h: { id: string }) => h.id)).toEqual(["c", "a", "b"]);
  });

  it("returns 400 rerank_unavailable when no reranker is configured", async () => {
    const app = await seeded();
    const res = await request(app).get("/v1/search").query({ q: "water", rerank: "true" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("rerank_unavailable");
  });
});

describe("documents", () => {
  it("rejects an empty documents array", async () => {
    const res = await request(createApp(makeDeps())).post("/v1/documents").send({ documents: [] });
    expect(res.status).toBe(400);
  });

  it("rejects more than 500 documents", async () => {
    const documents = Array.from({ length: 501 }, (_, i) => ({ id: `d${i}`, title: "t", text: "x" }));
    const res = await request(createApp(makeDeps())).post("/v1/documents").send({ documents });
    expect(res.status).toBe(400);
  });

  it("deletes a document and 404s on an unknown id", async () => {
    const app = await seeded();
    expect((await request(app).delete("/v1/documents/b")).status).toBe(204);
    const res = await request(app).get("/v1/search").query({ q: "espresso", mode: "bm25" });
    expect(res.body.results).toEqual([]);
    expect((await request(app).delete("/v1/documents/b")).status).toBe(404);
  });

  it("replaces a document re-posted under the same id", async () => {
    const app = await seeded();
    await request(app)
      .post("/v1/documents")
      .send({ documents: [{ id: "b", title: "Kettle", text: "Boiling water quickly." }] });
    const res = await request(app).get("/v1/search").query({ q: "espresso", mode: "bm25" });
    expect(res.body.results).toEqual([]);
  });
});

describe("GET /healthz", () => {
  it("reports ok", async () => {
    const res = await request(createApp(makeDeps())).get("/healthz");
    expect(res.body).toEqual({ status: "ok" });
  });
});
