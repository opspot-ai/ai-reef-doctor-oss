import { describe, it, expect, vi } from "vitest";
import {
  DOSE_WARNING,
  COPPER_RANGES,
  type ParameterReading,
} from "@reef/shared";
import {
  CHAT_TOOLS,
  executeTool,
  type ToolContext,
  type DoseResult,
} from "@/lib/ai/tools";

describe("CHAT_TOOLS", () => {
  it("exposes the four deterministic doctor tools", () => {
    const names = CHAT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "compatibility_check",
        "dosing_calculator",
        "get_tank_parameters",
        "lookup_species",
      ].sort(),
    );
  });

  it("every tool has a name, description, and a JSON-schema input_schema", () => {
    for (const tool of CHAT_TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.input_schema).toBeTruthy();
      expect((tool.input_schema as { type?: string }).type).toBe("object");
      // properties must be a (possibly empty) object
      expect(typeof (tool.input_schema as { properties?: unknown }).properties)
        .toBe("object");
    }
  });

  it("dosing_calculator schema enumerates the supported parameters", () => {
    const tool = CHAT_TOOLS.find((t) => t.name === "dosing_calculator")!;
    const props = (tool.input_schema as {
      properties: { parameter: { enum: string[] } };
    }).properties;
    expect(props.parameter.enum.sort()).toEqual(
      ["alkalinity", "calcium", "copper", "magnesium"].sort(),
    );
  });
});

describe("executeTool: dosing_calculator", () => {
  const ctx: ToolContext = {};

  it("computes an alkalinity dose whose warnings include the dose warning", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      { parameter: "alkalinity", volumeLiters: 200, current: 7, target: 8 },
      ctx,
    )) as DoseResult;
    expect(res.recommendedMl).toBeGreaterThan(0);
    expect(res.warnings).toContain(DOSE_WARNING);
  });

  it("uses ctx.volumeLiters when the input omits it", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      { parameter: "calcium", current: 380, target: 420 },
      { volumeLiters: 100 },
    )) as DoseResult;
    expect(res.recommendedMl).toBeGreaterThan(0);
    expect(res.warnings).toContain(DOSE_WARNING);
  });

  it("computes a calcium dose", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      { parameter: "calcium", volumeLiters: 100, current: 400, target: 420 },
      ctx,
    )) as DoseResult;
    expect(res.recommendedMl).toBeGreaterThan(0);
    expect(res.warnings).toContain(DOSE_WARNING);
  });

  it("computes a magnesium dose", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      { parameter: "magnesium", volumeLiters: 100, current: 1200, target: 1300 },
      ctx,
    )) as DoseResult;
    expect(res.recommendedMl).toBeGreaterThan(0);
    expect(res.warnings).toContain(DOSE_WARNING);
  });

  it("clamps an over-range copper target down into the therapeutic window", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      {
        parameter: "copper",
        volumeLiters: 100,
        current: 0,
        target: 5, // far above chelated max (2.5)
        copperType: "chelated",
        productPpmPerMlPerL: 0.01,
      },
      ctx,
    )) as DoseResult;
    expect(res.clamped).toBe(true);
    expect(res.warnings).toContain(DOSE_WARNING);
    // the chelated max is the ceiling; computed mL must reflect the clamp,
    // not the requested (too-high) target.
    const maxMl =
      ((COPPER_RANGES.chelated.max - 0) * 100) / 0.01;
    expect(res.recommendedMl).toBeLessThanOrEqual(maxMl + 0.01);
  });

  it("defaults copper to ionic when copperType is omitted", async () => {
    const res = (await executeTool(
      "dosing_calculator",
      {
        parameter: "copper",
        volumeLiters: 100,
        current: 0,
        target: 5, // above ionic max (0.3) → clamp
        productPpmPerMlPerL: 0.01,
      },
      ctx,
    )) as DoseResult;
    expect(res.clamped).toBe(true);
    expect(res.warnings).toContain(DOSE_WARNING);
  });

  it("rejects an unknown dosing parameter", async () => {
    await expect(
      executeTool(
        "dosing_calculator",
        { parameter: "iron", volumeLiters: 100, current: 0, target: 1 },
        ctx,
      ),
    ).rejects.toThrow();
  });
});

describe("executeTool: lookup_species / compatibility_check", () => {
  it("lookup_species('clownfish') returns matching knowledge entries", async () => {
    const res = (await executeTool(
      "lookup_species",
      { query: "clownfish" },
      {},
    )) as Array<{ title: string; body: string; source: string }>;
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    for (const e of res) {
      expect(typeof e.title).toBe("string");
      expect(typeof e.body).toBe("string");
      expect(typeof e.source).toBe("string");
    }
  });

  it("lookup_species('ich') returns disease entries", async () => {
    const res = (await executeTool("lookup_species", { query: "ich" }, {})) as Array<{
      title: string;
    }>;
    expect(res.length).toBeGreaterThan(0);
    expect(res.some((e) => /ich/i.test(e.title))).toBe(true);
  });

  it("compatibility_check joins the items into a retrieval query", async () => {
    const res = (await executeTool(
      "compatibility_check",
      { items: ["clownfish", "ich"] },
      {},
    )) as Array<{ title: string; body: string; source: string }>;
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]).toHaveProperty("title");
    expect(res[0]).toHaveProperty("body");
    expect(res[0]).toHaveProperty("source");
  });

  it("returns [] for an empty / unmatched lookup query", async () => {
    const res = (await executeTool("lookup_species", { query: "" }, {})) as unknown[];
    expect(res).toEqual([]);
  });
});

describe("executeTool: get_tank_parameters", () => {
  it("uses the ctx callback when provided", async () => {
    const reading: ParameterReading = {
      alkalinity_dkh: 8.2,
      calcium_ppm: 420,
      source: "manual",
    };
    const getParameters = vi.fn(async () => reading);
    const res = await executeTool("get_tank_parameters", {}, { getParameters });
    expect(getParameters).toHaveBeenCalledOnce();
    expect(res).toEqual(reading);
  });

  it("returns null when no callback is provided", async () => {
    const res = await executeTool("get_tank_parameters", {}, {});
    expect(res).toBeNull();
  });

  it("returns null when the callback yields null", async () => {
    const getParameters = vi.fn(async () => null);
    const res = await executeTool("get_tank_parameters", {}, { getParameters });
    expect(res).toBeNull();
  });
});

describe("executeTool: unknown tool", () => {
  it("throws on an unknown tool name", async () => {
    await expect(executeTool("does_not_exist", {}, {})).rejects.toThrow();
  });
});
