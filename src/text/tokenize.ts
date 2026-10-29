const STOPWORDS = new Set([
  "a", "about", "after", "again", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "been", "before", "being", "both", "but", "by", "can", "could", "did", "do",
  "does", "each", "for", "from", "had", "has", "have", "he", "her", "his", "how", "i",
  "if", "in", "into", "is", "it", "its", "just", "me", "more", "most", "my", "no",
  "not", "of", "on", "only", "or", "other", "our", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "then", "there",
  "these", "they", "this", "to", "too", "under", "up", "very", "was", "we", "were",
  "what", "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

/** NFKD-normalises, lowercases, strips combining marks, splits on non-alphanumerics and drops stopwords. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}+/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}
