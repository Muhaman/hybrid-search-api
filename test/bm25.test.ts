import { describe, expect, it } from "vitest";
import { Bm25Index } from "../src/search/bm25.js";

function build(): Bm25Index {
  const index = new Bm25Index();
  index.add("1", "the cat sat");
  index.add("2", "the dog sat");
  index.add("3", "cat cat dog");
  return index;
}

describe("Bm25Index", () => {
  it("ranks the document with higher term frequency first and omits non-matches", () => {
    const hits = build().search("cat", 10);
    expect(hits.map((h) => h.id)).toEqual(["3", "1"]);
  });

  it("computes IDF as ln(1 + (N - n + 0.5) / (n + 0.5))", () => {
    expect(build().idf("cat")).toBeCloseTo(Math.log(1 + 1.5 / 2.5), 9);
  });

  it("excludes removed documents", () => {
    const index = build();
    index.remove("3");
    expect(index.search("cat", 10).map((h) => h.id)).toEqual(["1"]);
  });

  it("replaces a document when the same id is added again", () => {
    const index = build();
    index.add("1", "bird");
    expect(index.search("cat", 10).map((h) => h.id)).toEqual(["3"]);
    expect(index.search("bird", 10).map((h) => h.id)).toEqual(["1"]);
  });

  it("respects k and returns nothing on an empty index", () => {
    expect(build().search("dog sat", 1)).toHaveLength(1);
    expect(new Bm25Index().search("cat", 5)).toEqual([]);
  });
});
