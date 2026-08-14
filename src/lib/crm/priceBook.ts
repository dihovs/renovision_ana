import { db, isMissingTable, MigrationPendingError } from "./db";
import type { PriceBookItem } from "./quoteTypes";

/**
 * The price book — saved line items that quotes and invoices draw from.
 *
 * Adding an item to a quote COPIES its values onto that quote's line. Editing
 * an item here never reaches documents already written: repricing in the
 * spring must not silently rewrite a quote sent in the autumn.
 */

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type PriceBookInput = {
  itemCode?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  unitCostCents?: number | null;
  unitPriceCents: number;
  laborHoursPerUnit?: number | null;
  laborClass?: string | null;
  taxable?: boolean;
  keywords?: string | null;
  exclusions?: string | null;
};

function columns(input: PriceBookInput) {
  return {
    item_code: orNull(input.itemCode),
    name: input.name.trim(),
    description: orNull(input.description),
    category: orNull(input.category),
    subcategory: orNull(input.subcategory),
    unit: orNull(input.unit),
    unit_cost_cents: input.unitCostCents ?? null,
    unit_price_cents: input.unitPriceCents,
    labor_hours_per_unit: input.laborHoursPerUnit ?? null,
    labor_class: orNull(input.laborClass),
    taxable: input.taxable ?? true,
    keywords: orNull(input.keywords),
    exclusions: orNull(input.exclusions),
  };
}

export async function listPriceBook(
  options: { search?: string; category?: string; includeArchived?: boolean; limit?: number } = {},
): Promise<PriceBookItem[]> {
  const client = requireDb();
  const { search, category, includeArchived = false, limit = 500 } = options;

  let query = client
    .from("price_book_items")
    // select("*") on purpose — an explicit column list has already drifted from
    // its type twice in this codebase, and the result is cast either way.
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(limit);

  if (!includeArchived) query = query.is("archived_at", null);
  if (category) query = query.eq("category", category);

  const term = search?.trim();
  if (term) {
    // Commas and parens would be read as `or` syntax and split the filter into
    // malformed clauses, so they are neutralised before interpolation.
    const safe = term.replace(/[,()]/g, " ");
    query = query.or(
      `name.ilike.%${safe}%,keywords.ilike.%${safe}%,item_code.ilike.%${safe}%,description.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("price_book_items", error.message);
    throw new Error(`Could not load the price book: ${error.message}`);
  }
  return (data ?? []) as PriceBookItem[];
}

export async function createPriceBookItem(input: PriceBookInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("price_book_items")
    .insert(columns(input))
    .select("id")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("price_book_items", error.message);
    if (error.code === "23505") throw new Error("That item code is already in use.");
    throw new Error(`Could not save the item: ${error.message}`);
  }
  return data.id as string;
}

export async function updatePriceBookItem(id: string, input: PriceBookInput): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("price_book_items").update(columns(input)).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("That item code is already in use.");
    throw new Error(`Could not save the item: ${error.message}`);
  }
}

export async function setPriceBookArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("price_book_items")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not archive the item: ${error.message}`);
}

export async function listCategories(): Promise<string[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("price_book_items")
    .select("category")
    .is("archived_at", null);
  if (error) return [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as { category: string | null }[]) {
    if (row.category) seen.add(row.category);
  }
  return [...seen].sort();
}

export async function countPriceBook(): Promise<number> {
  const client = db();
  if (!client) return 0;
  const { count, error } = await client
    .from("price_book_items")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Seed the price book from the estimator's static catalog.
 *
 * Idempotent by item_code: re-running updates nothing and inserts only what is
 * missing, so it is safe to run again after the catalog grows. Deliberately
 * does NOT overwrite existing rows — once the owner has repriced an item here,
 * this table is the source of truth and the TypeScript catalog is history.
 *
 * Cost is left null. The public catalog carries only a sell rate; internal cost
 * was stripped from it, so there is nothing truthful to seed and a guess would
 * produce a confident, wrong margin on every line.
 */
export async function seedPriceBookFromCatalog(): Promise<{ inserted: number; skipped: number }> {
  const client = requireDb();
  const { LINE_ITEMS } = await import("@/lib/estimator/data/lineItems");

  const { data: existing, error: readError } = await client
    .from("price_book_items")
    .select("item_code");
  if (readError) {
    if (isMissingTable(readError)) throw new MigrationPendingError("price_book_items", readError.message);
    throw new Error(`Could not read the price book: ${readError.message}`);
  }

  const have = new Set(
    ((existing ?? []) as { item_code: string | null }[]).flatMap((r) =>
      r.item_code ? [r.item_code] : [],
    ),
  );

  const rows = LINE_ITEMS.filter((item) => !have.has(item.itemCode)).map((item) => ({
    item_code: item.itemCode,
    name: item.name,
    // Exclusions are customer-facing scope caveats and belong in the printed
    // description. Keywords are search terms — putting those on a customer's
    // quote would print search noise on a document they are asked to sign.
    description: item.exclusions ?? null,
    category: item.category,
    subcategory: item.subcategory,
    unit: item.unit,
    unit_cost_cents: null,
    unit_price_cents: Math.round(item.salesRate * 100),
    labor_hours_per_unit: item.laborHoursPerUnit,
    labor_class: item.laborClass,
    taxable: item.taxable,
    keywords: item.keywords,
    exclusions: item.exclusions ?? null,
  }));

  if (rows.length === 0) return { inserted: 0, skipped: LINE_ITEMS.length };

  const { error } = await client.from("price_book_items").insert(rows);
  if (error) throw new Error(`Could not seed the price book: ${error.message}`);

  return { inserted: rows.length, skipped: LINE_ITEMS.length - rows.length };
}
