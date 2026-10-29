import { describe, expect, it } from "vitest";
import { tokenize } from "../src/text/tokenize.js";

describe("tokenize", () => {
  it("lowercases, splits on punctuation and drops stopwords", () => {
    expect(tokenize("The CAT's hat!")).toEqual(["cat", "s", "hat"]);
  });

  it("folds diacritics", () => {
    expect(tokenize("Café Münster")).toEqual(["cafe", "munster"]);
  });

  it("returns nothing for stopword-only input", () => {
    expect(tokenize("the and of")).toEqual([]);
  });
});
