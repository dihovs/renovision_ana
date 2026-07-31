"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { parseMoneyToCents } from "@/lib/crm/money";
import {
  createPriceBookItem,
  seedPriceBookFromCatalog,
  setPriceBookArchived,
  updatePriceBookItem,
  type PriceBookInput,
} from "@/lib/crm/priceBook";

export type PriceBookState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseInput(formData: FormData): PriceBookInput {
  const name = str(formData, "name");
  if (!name) throw new Error("Give the item a name.");

  // parseMoneyToCents, never Number() — the operator may type "8,60" on a
  // French keyboard, and Number("8,60") is NaN.
  const price = parseMoneyToCents(str(formData, "unitPrice"));
  const cost = parseMoneyToCents(str(formData, "unitCost"));
  const hours = str(formData, "laborHours");

  return {
    itemCode: str(formData, "itemCode") || null,
    name,
    description: str(formData, "description") || null,
    category: str(formData, "category") || null,
    subcategory: str(formData, "subcategory") || null,
    unit: str(formData, "unit") || null,
    // Null, not zero: "cost unknown" and "costs nothing" produce very
    // different margin figures, and only one of them is true.
    unitCostCents: cost,
    unitPriceCents: price ?? 0,
    laborHoursPerUnit: hours ? Number(hours.replace(",", ".")) || null : null,
    laborClass: str(formData, "laborClass") || null,
    taxable: formData.get("taxable") !== null,
    keywords: str(formData, "keywords") || null,
    exclusions: str(formData, "exclusions") || null,
  };
}

export async function createItemAction(
  _prev: PriceBookState,
  formData: FormData,
): Promise<PriceBookState> {
  await requireSession();
  try {
    await createPriceBookItem(parseInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the item." };
  }
  revalidatePath("/admin/price-book");
  return { ok: "Added" };
}

export async function updateItemAction(
  id: string,
  _prev: PriceBookState,
  formData: FormData,
): Promise<PriceBookState> {
  await requireSession();
  try {
    await updatePriceBookItem(id, parseInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the item." };
  }
  revalidatePath("/admin/price-book");
  return { ok: "Saved" };
}

export async function archiveItemAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setPriceBookArchived(id, archived);
  revalidatePath("/admin/price-book");
}

/**
 * Import the 128-item estimator catalog.
 *
 * Idempotent by item code, so pressing it twice is safe and pressing it after
 * repricing an item will not undo that work.
 */
export async function seedAction(_prev: PriceBookState): Promise<PriceBookState> {
  await requireSession();
  try {
    const { inserted, skipped } = await seedPriceBookFromCatalog();
    revalidatePath("/admin/price-book");
    return {
      ok:
        inserted === 0
          ? "Already imported — nothing new to add."
          : `Imported ${inserted} item${inserted === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already present` : ""}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not import the catalog." };
  }
}
