import { LINE_ITEMS } from "./data/lineItems";
import type { LineItem } from "./types";

const BY_CODE = new Map<string, LineItem>(LINE_ITEMS.map((it) => [it.itemCode, it]));

export function getLineItem(code: string): LineItem | undefined {
  return BY_CODE.get(code);
}

export function hasLineItem(code: string): boolean {
  return BY_CODE.has(code);
}

export { LINE_ITEMS };

/**
 * A compact, prompt-ready listing of the catalog: one line per item,
 * grouped by category, giving Claude the code, name, unit and keywords it
 * needs to select items — without the full object noise. Sales rates are
 * intentionally omitted from the prompt so the model can't be tempted to do
 * the money math itself; the backend prices every code it returns.
 */
export function buildCatalogSummary(): string {
  const byCategory = new Map<string, LineItem[]>();
  for (const it of LINE_ITEMS) {
    const list = byCategory.get(it.category) ?? [];
    list.push(it);
    byCategory.set(it.category, list);
  }

  const sections: string[] = [];
  for (const [category, items] of byCategory) {
    const lines = items.map(
      (it) =>
        `  ${it.itemCode} | ${it.name} (per ${it.unit}) — ${it.keywords}` +
        (it.exclusions ? ` [excludes: ${it.exclusions}]` : ""),
    );
    sections.push(`${category}:\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}
