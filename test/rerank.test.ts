import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ClaudeReranker } from "../src/rerank.js";

const DOCS = [
  { id: "a", text: "alpha" },
  { id: "b", text: "beta" },
];

function rerankerWith(parse: () => Promise<unknown>): ClaudeReranker {
  const client = { messages: { parse } } as unknown as Anthropic;
  return new ClaudeReranker(client, "claude-haiku-5-5");
}

const reply = (fields: Record<string, unknown>) => async () => ({
  stop_reason: "end_turn",
  stop_details: null,
  parsed_output: null,
  ...fields,
});

describe("ClaudeReranker", () => {
  it("returns clamped relevance scores", async () => {
    const reranker = rerankerWith(
      reply({ parsed_output: { scores: [{ id: "a", relevance: 7 }, { id: "b", relevance: 2 }] } }),
    );
    expect(await reranker.rerank("q", DOCS)).toEqual([
      { id: "a", score: 3 },
      { id: "b", score: 2 },
    ]);
  });

  it("maps a refusal to 502 refusal", async () => {
    const reranker = rerankerWith(reply({ stop_reason: "refusal", stop_details: { category: "cyber" } }));
    await expect(reranker.rerank("q", DOCS)).rejects.toMatchObject({ status: 502, code: "refusal" });
  });

  it("maps max_tokens to 502 max_tokens", async () => {
    const reranker = rerankerWith(reply({ stop_reason: "max_tokens" }));
    await expect(reranker.rerank("q", DOCS)).rejects.toMatchObject({ status: 502, code: "max_tokens" });
  });

  it("maps missing parsed output to 502 invalid_model_output", async () => {
    await expect(rerankerWith(reply({})).rerank("q", DOCS)).rejects.toMatchObject({
      status: 502,
      code: "invalid_model_output",
    });
  });

  it("maps SyntaxError and ZodError to 502 invalid_model_output", async () => {
    const zodError = z.object({ x: z.string() }).safeParse({}).error;
    for (const thrown of [new SyntaxError("bad json"), zodError]) {
      const reranker = rerankerWith(async () => {
        throw thrown;
      });
      await expect(reranker.rerank("q", DOCS)).rejects.toMatchObject({
        status: 502,
        code: "invalid_model_output",
      });
    }
  });

  it("maps Anthropic API errors to 502 upstream_error", async () => {
    const reranker = rerankerWith(async () => {
      throw new Anthropic.APIError(500, undefined, "boom", undefined);
    });
    await expect(reranker.rerank("q", DOCS)).rejects.toMatchObject({ status: 502, code: "upstream_error" });
  });
});
