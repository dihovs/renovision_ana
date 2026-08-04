import { describe, expect, it } from "vitest";
import { runWebEstimateTool, webCatalogSummary, WEB_ESTIMATE_TOOL } from "./webTools";
import { calculateEstimate, formatCents } from "@/lib/estimator/calculate";

/**
 * runWebEstimateTool() is the one place a real dollar figure is handed back
 * to Claude for the web widget to relay verbatim — everywhere else on the
 * phone, Ana has no pricing data at all (see the guardrail comment in
 * agent.ts). So what matters here is narrower than "the math is right"
 * (calculate.test.ts already proves that): it's that the sentence handed
 * back always carries the SAME numbers calculateEstimate() actually
 * produced, in both languages, and degrades sensibly when the model sends
 * garbage.
 */
describe("runWebEstimateTool", () => {
  it("returns a sentence carrying the real computed range, in English", () => {
    const input = { scopeSummary: "floor protection", lines: [{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }] };
    const result = calculateEstimate(input.lines);

    const text = runWebEstimateTool(input, "en");

    expect(text).toContain(formatCents(result.lowCents));
    expect(text).toContain(formatCents(result.highCents));
    expect(text).toMatch(/preliminary|approximation/i);
  });

  it("returns the same range in French, not the English sentence", () => {
    const input = { scopeSummary: "protection de plancher", lines: [{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }] };
    const result = calculateEstimate(input.lines);

    const text = runWebEstimateTool(input, "fr");

    expect(text).toContain(formatCents(result.lowCents));
    expect(text).toContain(formatCents(result.highCents));
    expect(text).not.toMatch(/preliminary|approximation range/i);
    expect(text).toMatch(/approximative/i);
  });

  it("never invents a price for an unknown item code", () => {
    const text = runWebEstimateTool(
      { scopeSummary: "something", lines: [{ itemCode: "NOT-A-REAL-CODE", quantity: 5 }] },
      "en",
    );

    expect(text).not.toMatch(/\$/);
    expect(text).toMatch(/no valid catalog items/i);
  });

  it("flags unknown codes alongside a real range rather than silently dropping them", () => {
    const text = runWebEstimateTool(
      {
        scopeSummary: "mixed scope",
        lines: [
          { itemCode: "GEN-FLOOR-PROT", quantity: 100 },
          { itemCode: "MADE-UP-CODE", quantity: 1 },
        ],
      },
      "en",
    );

    expect(text).toMatch(/\$/);
    expect(text).toMatch(/MADE-UP-CODE/);
  });

  it("degrades safely on malformed tool input rather than throwing", () => {
    expect(() => runWebEstimateTool(null, "en")).not.toThrow();
    expect(() => runWebEstimateTool({}, "en")).not.toThrow();
    expect(() => runWebEstimateTool({ lines: "not an array" }, "en")).not.toThrow();
    expect(() =>
      runWebEstimateTool({ lines: [{ itemCode: 42, quantity: "five" }] }, "en"),
    ).not.toThrow();
  });

  it("exposes the same catalog the text chat estimator's system prompt uses, non-empty", () => {
    expect(webCatalogSummary().length).toBeGreaterThan(100);
    expect(webCatalogSummary()).toContain("GEN-FLOOR-PROT");
  });

  it("declares an input schema requiring scopeSummary and lines", () => {
    expect(WEB_ESTIMATE_TOOL.name).toBe("build_estimate");
    expect(WEB_ESTIMATE_TOOL.input_schema.required).toEqual(["scopeSummary", "lines"]);
  });
});
