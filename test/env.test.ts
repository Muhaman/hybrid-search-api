import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("boots with no variables and applies defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.RERANK_MODEL).toBe("claude-haiku-5-5");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("treats an empty ANTHROPIC_API_KEY as unset", () => {
    expect(loadEnv({ ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("rejects an invalid PORT naming the variable", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow(/PORT/);
  });
});
