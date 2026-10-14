import {
  KNOWLEDGE,
  retrieve,
  knowledgeAsContext,
  type KnowledgeEntry,
} from "./index";

const VALID_TOPICS = [
  "disease",
  "coral",
  "algae",
  "params",
  "treatment",
  "species",
  "general",
] as const;

describe("KNOWLEDGE corpus", () => {
  it("has at least 24 entries", () => {
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(24);
  });

  it("every entry has all required fields with valid shapes", () => {
    for (const entry of KNOWLEDGE) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(VALID_TOPICS).toContain(entry.topic);
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.body).toBe("string");
      expect(entry.body.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(entry.tags.length).toBeGreaterThan(0);
      for (const tag of entry.tags) {
        expect(typeof tag).toBe("string");
        expect(tag.length).toBeGreaterThan(0);
      }
      expect(typeof entry.source).toBe("string");
      expect(entry.source.length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = KNOWLEDGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each body is a couple of sentences (substantive content)", () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.body.length).toBeGreaterThanOrEqual(40);
    }
  });

  it("covers the required disease topics", () => {
    const blob = KNOWLEDGE.map((e) =>
      `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase(),
    ).join(" ");
    for (const term of [
      "cryptocaryon",
      "amyloodinium",
      "brooklynella",
      "uronema",
      "fluke",
      "fin rot",
      "popeye",
      "hlle",
    ]) {
      expect(blob).toContain(term);
    }
  });

  it("covers the required treatment topics", () => {
    const blob = KNOWLEDGE.map((e) =>
      `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase(),
    ).join(" ");
    for (const term of [
      "copper",
      "hyposalinity",
      "tank transfer",
      "formalin",
      "prazi",
      "quarantine",
    ]) {
      expect(blob).toContain(term);
    }
  });

  it("covers the required algae/pest and coral topics", () => {
    const blob = KNOWLEDGE.map((e) =>
      `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase(),
    ).join(" ");
    for (const term of [
      "cyano",
      "dinoflagellate",
      "diatom",
      "hair algae",
      "bryopsis",
      "aiptasia",
      "vermetid",
      "flatworm",
      "aefw",
      "red bug",
      "bleach",
      "rtn",
    ]) {
      expect(blob).toContain(term);
    }
  });

  it("uses at least several distinct topics", () => {
    const topics = new Set(KNOWLEDGE.map((e) => e.topic));
    expect(topics.size).toBeGreaterThanOrEqual(5);
  });
});

describe("retrieve()", () => {
  it("returns [] for an empty query and never throws", () => {
    expect(retrieve("")).toEqual([]);
    expect(retrieve("   ")).toEqual([]);
    expect(retrieve("\t\n")).toEqual([]);
  });

  it("surfaces marine ich + copper for a treatment query", () => {
    const results = retrieve("marine ich treatment");
    expect(results.length).toBeGreaterThan(0);
    const blob = results
      .map((r) => `${r.id} ${r.title} ${r.tags.join(" ")}`.toLowerCase())
      .join(" || ");
    // Top results should include the ich (cryptocaryon) guide.
    expect(
      /ich|cryptocaryon/.test(blob),
    ).toBe(true);
    // and the copper treatment should be surfaced.
    expect(/copper/.test(blob)).toBe(true);
  });

  it("respects the k limit (default 4)", () => {
    expect(retrieve("reef").length).toBeLessThanOrEqual(4);
    expect(retrieve("reef tank algae disease treatment", 2).length).toBeLessThanOrEqual(2);
    expect(retrieve("reef tank algae disease treatment", 1).length).toBeLessThanOrEqual(1);
  });

  it("returns at most as many entries as exist when k is huge", () => {
    const results = retrieve("reef tank water disease algae coral copper", 9999);
    expect(results.length).toBeLessThanOrEqual(KNOWLEDGE.length);
  });

  it("returns relevant entries ranked by overlap (cyano query surfaces cyanobacteria)", () => {
    const results = retrieve("red slime cyanobacteria");
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top).toBeDefined();
    const topBlob = `${top!.title} ${top!.tags.join(" ")} ${top!.body}`.toLowerCase();
    expect(/cyano|red slime/.test(topBlob)).toBe(true);
  });

  it("is deterministic for the same query", () => {
    const a = retrieve("dinoflagellates dino bloom");
    const b = retrieve("dinoflagellates dino bloom");
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it("returns [] when no token matches anything", () => {
    expect(retrieve("zzzzqqqxnotarealword")).toEqual([]);
  });

  it("is case-insensitive", () => {
    const lower = retrieve("brooklynella");
    const upper = retrieve("BROOKLYNELLA");
    expect(lower.map((e) => e.id)).toEqual(upper.map((e) => e.id));
    expect(lower.length).toBeGreaterThan(0);
  });
});

describe("knowledgeAsContext()", () => {
  it("includes a [source] citation for each entry", () => {
    const entries = retrieve("marine velvet copper quarantine");
    expect(entries.length).toBeGreaterThan(0);
    const ctx = knowledgeAsContext(entries);
    expect(typeof ctx).toBe("string");
    for (const e of entries) {
      expect(ctx).toContain(e.source);
      expect(ctx).toContain(e.title);
    }
    // citation marker present
    expect(ctx).toContain("[source:");
  });

  it("returns a non-empty block for non-empty input", () => {
    const ctx = knowledgeAsContext(retrieve("nitrogen cycle"));
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("handles an empty list gracefully", () => {
    const ctx = knowledgeAsContext([]);
    expect(typeof ctx).toBe("string");
  });

  it("formats a synthetic entry with its source label", () => {
    const fake: KnowledgeEntry = {
      id: "test-entry",
      topic: "general",
      title: "Test Title",
      body: "A test body sentence describing something.",
      tags: ["test"],
      source: "Unit Test Source",
    };
    const ctx = knowledgeAsContext([fake]);
    expect(ctx).toContain("Test Title");
    expect(ctx).toContain("Unit Test Source");
    expect(ctx).toContain("test-entry");
  });
});
