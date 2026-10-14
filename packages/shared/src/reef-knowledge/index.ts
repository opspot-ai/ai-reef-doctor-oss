/**
 * @reef/shared/reef-knowledge — curated, citeable reef knowledge base + a tiny
 * keyword retriever . No external DB; the corpus lives in ./corpus and
 * is the grounding source for chat/diagnosis RAG. Selected chunk ids become
 * grounding `sources` on AI responses, and `knowledgeAsContext` formats picked
 * chunks into the stable, prompt-cacheable system-context block.
 */
import { KNOWLEDGE as CORPUS } from "./corpus";

export interface KnowledgeEntry {
  id: string;
  topic:
    | "disease"
    | "coral"
    | "algae"
    | "params"
    | "treatment"
    | "species"
    | "general";
  title: string;
  body: string;
  tags: string[];
  source: string;
}

/** The full curated corpus (defined in ./corpus, re-exported here). */
export const KNOWLEDGE: KnowledgeEntry[] = CORPUS;

/**
 * Topic priority for deterministic tie-breaking — health-critical topics rank
 * ahead of general info when scores are equal (lower number = higher priority).
 */
const TOPIC_PRIORITY: Record<KnowledgeEntry["topic"], number> = {
  disease: 0,
  treatment: 1,
  params: 2,
  coral: 3,
  algae: 4,
  species: 5,
  general: 6,
};

/** Common, low-signal words we ignore when tokenizing a query. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "do",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "so",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "up",
  "was",
  "what",
  "when",
  "why",
  "with",
  "you",
  "your",
]);

/** Lowercase, split on non-alphanumerics, drop stopwords and 1-char noise. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Pre-tokenized search index per entry (built once at module load). */
interface IndexedEntry {
  entry: KnowledgeEntry;
  /** token -> weight, where title/tag tokens are weighted higher than body. */
  weights: Map<string, number>;
  /** the entry's tag-token set (case-insensitive) for exact-tag bonuses. */
  tagTokens: Set<string>;
}

const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 3;
const BODY_WEIGHT = 1;

const INDEX: IndexedEntry[] = KNOWLEDGE.map((entry) => {
  const weights = new Map<string, number>();
  const add = (tokens: string[], weight: number) => {
    for (const tok of tokens) {
      weights.set(tok, (weights.get(tok) ?? 0) + weight);
    }
  };
  add(tokenize(entry.title), TITLE_WEIGHT);
  for (const tag of entry.tags) add(tokenize(tag), TAG_WEIGHT);
  add(tokenize(entry.body), BODY_WEIGHT);

  const tagTokens = new Set<string>();
  for (const tag of entry.tags) {
    const norm = tag.toLowerCase().trim();
    if (norm.length > 0) tagTokens.add(norm);
  }

  return { entry, weights, tagTokens };
});

/**
 * Retrieve the top-k knowledge entries by case-insensitive keyword/tag overlap
 * between the query tokens and each entry's title + tags + body. Title and tag
 * matches are weighted higher than body matches; a full multi-word tag phrase
 * present in the query earns an extra bonus. Ties break by topic priority then
 * id (deterministic). Never throws — an empty / all-stopword / non-matching
 * query returns []. Default k = 4.
 */
export function retrieve(query: string, k = 4): KnowledgeEntry[] {
  if (typeof query !== "string") return [];
  const tokens = tokenize(query);
  if (tokens.length === 0 || k <= 0) return [];

  const queryTokenSet = new Set(tokens);
  const normalizedQuery = query.toLowerCase();

  const scored: { entry: KnowledgeEntry; score: number }[] = [];
  for (const { entry, weights, tagTokens } of INDEX) {
    let score = 0;
    for (const tok of queryTokenSet) {
      score += weights.get(tok) ?? 0;
    }
    // Bonus when a full multi-word tag phrase appears verbatim in the query
    // (e.g. "marine ich", "tank transfer") — strong signal of relevance.
    for (const tag of tagTokens) {
      if (tag.includes(" ") && normalizedQuery.includes(tag)) {
        score += TAG_WEIGHT * 2;
      }
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = TOPIC_PRIORITY[a.entry.topic];
    const pb = TOPIC_PRIORITY[b.entry.topic];
    if (pa !== pb) return pa - pb;
    return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
  });

  return scored.slice(0, k).map((s) => s.entry);
}

/**
 * Format selected entries into a compact, grounded-context block suitable for a
 * cached system prompt. Each entry carries a [source: …] citation so the model
 * can attribute claims and so chunk ids can become DiagnosisResult.sources.
 */
export function knowledgeAsContext(entries: KnowledgeEntry[]): string {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }
  const blocks = entries.map((e) => {
    const tags = e.tags.join(", ");
    return (
      `### ${e.title} [source: ${e.source} | id: ${e.id}]\n` +
      `Topic: ${e.topic} | Tags: ${tags}\n` +
      `${e.body}`
    );
  });
  return (
    "REEF KNOWLEDGE (grounding — cite [source] when you use a fact):\n\n" +
    blocks.join("\n\n")
  );
}
