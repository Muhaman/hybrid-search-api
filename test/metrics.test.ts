import { describe, expect, it } from "vitest";
import { mrr, ndcgAtK } from "../bench/metrics.js";

describe("metrics", () => {
  it("gives nDCG 1 for a perfect ranking", () => {
    expect(ndcgAtK(["a", "b", "c"], { a: 3, b: 2, c: 1 })).toBeCloseTo(1, 12);
  });

  it("penalises a misordered ranking", () => {
    expect(ndcgAtK(["c", "b", "a"], { a: 3, b: 2, c: 1 })).toBeLessThan(1);
  });

  it("gives nDCG 0 when nothing relevant is retrieved or nothing is relevant", () => {
    expect(ndcgAtK(["x", "y"], { a: 3 })).toBe(0);
    expect(ndcgAtK(["a"], {})).toBe(0);
  });

  it("gives MRR 0.5 when the first relevant hit is at rank 2", () => {
    expect(mrr(["x", "a"], new Set(["a"]))).toBe(0.5);
  });

  it("gives MRR 0 when no relevant hit is ranked", () => {
    expect(mrr(["x"], new Set(["a"]))).toBe(0);
  });
});
