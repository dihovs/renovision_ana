import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "./money";
import {
  canTransition,
  isEditable,
  isFrozen,
  marginHundredths,
  pricedLines,
  QUOTE_STATUSES,
  quoteLabel,
  toLineForTotals,
  type QuoteLineItem,
  type QuoteStatus,
} from "./quoteTypes";

function itemLine(over: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: "line-1",
    quote_id: "quote-1",
    position: 0,
    kind: "item",
    name: "Install laminate flooring",
    description: null,
    quantity_milli: 1000,
    unit: "sq ft",
    unit_cost_cents: null,
    unit_price_cents: 10_000,
    taxable: true,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
    tier: null,
    ...over,
  };
}

function textLine(over: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return itemLine({
    id: "line-text",
    kind: "text",
    name: "All debris hauled away daily.",
    quantity_milli: null,
    unit_price_cents: null,
    unit_cost_cents: null,
    ...over,
  });
}

describe("status predicates", () => {
  it("only draft and changes_requested are editable", () => {
    const editable = QUOTE_STATUSES.filter(isEditable);
    expect(editable).toEqual(["draft", "changes_requested"]);
  });

  it("everything except draft totals from its frozen snapshot", () => {
    const frozen = QUOTE_STATUSES.filter(isFrozen);
    expect(frozen).toEqual(QUOTE_STATUSES.filter((s) => s !== "draft"));
  });
});

describe("canTransition", () => {
  it("allows the documented lifecycle moves", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "viewed")).toBe(true);
    expect(canTransition("sent", "approved")).toBe(true);
    expect(canTransition("sent", "declined")).toBe(true);
    expect(canTransition("sent", "changes_requested")).toBe(true);
    expect(canTransition("viewed", "approved")).toBe(true);
    expect(canTransition("approved", "converted")).toBe(true);
    expect(canTransition("changes_requested", "draft")).toBe(true);
    expect(canTransition("changes_requested", "sent")).toBe(true);
    expect(canTransition("declined", "draft")).toBe(true);
  });

  it("blocks skipping straight from draft to approved", () => {
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("draft", "converted")).toBe(false);
  });

  it("never lets an approved quote fall back down the funnel", () => {
    expect(canTransition("approved", "draft")).toBe(false);
    expect(canTransition("approved", "sent")).toBe(false);
    expect(canTransition("approved", "declined")).toBe(false);
  });

  it("makes converted terminal", () => {
    for (const to of QUOTE_STATUSES) {
      expect(canTransition("converted", to as QuoteStatus)).toBe(false);
    }
  });
});

describe("toLineForTotals", () => {
  it("maps stored columns to the money engine shape", () => {
    expect(toLineForTotals(itemLine({ quantity_milli: 2500, unit_price_cents: 860, optional: true, selected: true }))).toEqual({
      quantityMilli: 2500,
      unitPriceCents: 860,
      taxable: true,
      optional: true,
      selected: true,
    });
  });

  it("coalesces null money columns to zero", () => {
    const mapped = toLineForTotals(itemLine({ quantity_milli: null, unit_price_cents: null }));
    expect(mapped.quantityMilli).toBe(0);
    expect(mapped.unitPriceCents).toBe(0);
  });
});

describe("pricedLines", () => {
  it("filters out text lines so they contribute nothing to totals", () => {
    const lines = [itemLine(), textLine(), itemLine({ id: "line-2", unit_price_cents: 5000 })];
    const priced = pricedLines(lines);
    expect(priced.map((l) => l.id)).toEqual(["line-1", "line-2"]);

    // Composed the way totalsFor does it: the text line is invisible to money.
    const totals = calculateQuoteTotals(
      priced.map(toLineForTotals),
      { id: "exempt", label: "No tax", components: [] },
    );
    expect(totals.subtotalCents).toBe(15_000);
  });
});

describe("quoteLabel", () => {
  it("prints the customer-facing number", () => {
    expect(quoteLabel({ quote_number: 1042 })).toBe("Quote #1042");
  });
});

describe("marginHundredths", () => {
  it("returns hundredths of a percent (50% -> 5000)", () => {
    expect(marginHundredths({ unit_cost_cents: 5000, unit_price_cents: 10_000 })).toBe(5000);
  });

  it("returns null when cost is unknown — never a fabricated 100%", () => {
    expect(marginHundredths({ unit_cost_cents: null, unit_price_cents: 10_000 })).toBeNull();
  });

  it("returns null for a free or negative price", () => {
    expect(marginHundredths({ unit_cost_cents: 5000, unit_price_cents: 0 })).toBeNull();
    expect(marginHundredths({ unit_cost_cents: 5000, unit_price_cents: -100 })).toBeNull();
  });

  it("treats an explicit zero cost as 100% margin", () => {
    expect(marginHundredths({ unit_cost_cents: 0, unit_price_cents: 10_000 })).toBe(10_000);
  });

  it("goes negative when work is sold below cost", () => {
    expect(marginHundredths({ unit_cost_cents: 15_000, unit_price_cents: 10_000 })).toBe(-5000);
  });

  it("keeps two decimals of a percent", () => {
    // 6666/9999 = 66.6666...% -> 6666.67 hundredths.
    expect(marginHundredths({ unit_cost_cents: 3333, unit_price_cents: 9999 })).toBe(6666.67);
  });
});
