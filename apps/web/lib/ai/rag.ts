/**
 * RAG grounding for AI routes . Wraps the shared keyword retriever so
 * chat/diagnosis routes get a cacheable knowledge-context block plus the grounding
 * `sources` citations that the safety layer requires on every health response.
 *
 * Pure data — no Anthropic SDK import, so it is safe to use (and test) with no
 * ANTHROPIC_API_KEY configured.
 */
import {
  retrieve,
  knowledgeAsContext,
  type SourceCitation,
} from "@reef/shared";

export interface Grounding {
  /** Formatted, prompt-cacheable knowledge block ("" when nothing matched). */
  context: string;
  /** Citations for the selected entries (one per retrieved entry). */
  sources: SourceCitation[];
}

/** Empty grounding — returned for blank queries or when nothing matches. */
const EMPTY: Grounding = { context: "", sources: [] };

/**
 * Ground a free-text query: retrieve the top-k knowledge entries, format them
 * into a context block, and map each to a {title, ref} citation. An empty or
 * whitespace-only query short-circuits to empty grounding.
 */
export function groundFor(query: string, k = 4): Grounding {
  if (typeof query !== "string" || query.trim().length === 0) {
    return { context: "", sources: [] };
  }
  const entries = retrieve(query, k);
  if (entries.length === 0) return { context: "", sources: [] };
  return {
    context: knowledgeAsContext(entries),
    sources: entries.map((e) => ({ title: e.title, ref: e.source })),
  };
}

/** Diagnosis kind → a base query that surfaces the most relevant corpus area. */
const KIND_QUERY: Record<
  "fish" | "coral" | "algae" | "params" | "symptom",
  string
> = {
  fish: "marine fish disease diagnosis treatment ",
  coral: "coral health disease pest bleaching tissue necrosis ",
  algae: "algae identification nuisance cyanobacteria dinoflagellates treatment ",
  params: "water parameters target ranges salinity alkalinity calcium magnesium nitrate phosphate ",
  symptom: "marine fish symptom disease diagnosis treatment ",
};

/**
 * Ground by diagnosis kind (+ optional free-text note). Builds a query string
 * from the kind so diagnosis routes get relevant grounding even before the model
 * runs, then delegates to {@link groundFor}.
 */
export function groundForKinds(
  kind: "fish" | "coral" | "algae" | "params" | "symptom",
  note?: string,
  k = 4,
): Grounding {
  const base = KIND_QUERY[kind];
  if (typeof base !== "string") return { context: "", sources: [] };
  const query = `${base}${note?.trim() ?? ""}`.trim();
  return groundFor(query, k);
}

export { EMPTY as EMPTY_GROUNDING };
