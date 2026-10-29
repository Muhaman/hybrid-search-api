import { describe, expect, it } from "vitest";
import { rrf } from "../src/search/fusion.js";

describe("rrf", () => {
  it("fuses ranked lists by reciprocal rank", () => {
    const fused = rrf([[{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]]);
    expect(fused.map((h) => h.id)).toEqual(["b", "a", "c"]);
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 62, 12);
  });

  it("honours a custom k", () => {
    const fused = rrf([[{ id: "a" }]], 10);
    expect(fused[0]?.score).toBeCloseTo(1 / 11, 12);
  });
});
