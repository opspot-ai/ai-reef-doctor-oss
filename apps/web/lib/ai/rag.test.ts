import { describe, expect, it } from "vitest";

import { groundFor, groundForKinds, EMPTY_GROUNDING } from "@/lib/ai/rag";

/** Does any source title match an ich/copper/quarantine-related concept? */
function hasIchRelatedSource(sources: { title: string }[]): boolean {
  return sources.some((s) =>
    /ich|cryptocaryon|copper|quarantine|qt|velvet/i.test(s.title),
  );
}

describe("groundFor", () => {
  it("returns non-empty context and >=1 ich-related source for an ich query", () => {
    const { context, sources } = groundFor("marine ich treatment");

    expect(context.length).toBeGreaterThan(0);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(hasIchRelatedSource(sources)).toBe(true);
  });

  it("includes the matched entry's body text in the context block", () => {
    const { context } = groundFor("marine ich treatment");
    // The corpus entry talks about copper / fallow quarantine — ground truth.
    expect(context.toLowerCase()).toContain("ich");
  });

  it("maps each entry to a {title, ref} citation", () => {
    const { sources } = groundFor("marine ich treatment");
    for (const s of sources) {
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.ref).toBe("string");
      expect(s.ref.length).toBeGreaterThan(0);
    }
  });

  it("returns empty grounding for an empty query", () => {
    expect(groundFor("")).toEqual({ context: "", sources: [] });
  });

  it("returns empty grounding for a whitespace-only query", () => {
    expect(groundFor("   \n\t  ")).toEqual({ context: "", sources: [] });
  });

  it("respects k (caps the number of sources)", () => {
    const k1 = groundFor("marine fish disease parasite copper", 1);
    expect(k1.sources.length).toBe(1);

    const k3 = groundFor("marine fish disease parasite copper", 3);
    expect(k3.sources.length).toBeLessThanOrEqual(3);
    expect(k3.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("defaults to at most 4 sources", () => {
    const { sources } = groundFor(
      "marine fish disease parasite copper quarantine velvet flukes",
    );
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources.length).toBeLessThanOrEqual(4);
  });

  it("returns empty grounding when k <= 0", () => {
    expect(groundFor("marine ich treatment", 0)).toEqual({
      context: "",
      sources: [],
    });
  });
});

describe("groundForKinds", () => {
  it("surfaces coral entries for kind 'coral'", () => {
    const { context, sources } = groundForKinds("coral");

    expect(context.length).toBeGreaterThan(0);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    // At least one selected entry should be a coral-topic title.
    expect(
      sources.some((s) => /coral|bleach|sps|necrosis|flatworm|nudibranch|bug/i.test(s.title)),
    ).toBe(true);
    expect(context.toLowerCase()).toContain("coral");
  });

  it("surfaces fish-disease entries for kind 'fish'", () => {
    const { sources } = groundForKinds("fish");
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(
      sources.some((s) =>
        /ich|velvet|brooklynella|uronema|fluke|fin rot|popeye|copper|quarantine/i.test(
          s.title,
        ),
      ),
    ).toBe(true);
  });

  it("surfaces algae entries for kind 'algae'", () => {
    const { sources } = groundForKinds("algae");
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(
      sources.some((s) =>
        /algae|cyano|dino|diatom|hair|bryopsis/i.test(s.title),
      ),
    ).toBe(true);
  });

  it("incorporates the note into the query to bias retrieval", () => {
    const { sources } = groundForKinds("fish", "white spots flashing scratching");
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(hasIchRelatedSource(sources)).toBe(true);
  });

  it("respects k", () => {
    const { sources } = groundForKinds("fish", undefined, 2);
    expect(sources.length).toBeLessThanOrEqual(2);
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it("returns grounding with the kind base query even with no note", () => {
    const { context, sources } = groundForKinds("params");
    expect(context.length).toBeGreaterThan(0);
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it("exports a shared empty grounding constant", () => {
    expect(EMPTY_GROUNDING).toEqual({ context: "", sources: [] });
  });
});
