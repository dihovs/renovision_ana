"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { writeSetting, type CompanySetting, type QuoteDefaultsSetting } from "@/lib/crm/settings";

export type SettingsState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveCompanyAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();

  const company: CompanySetting = {
    legalName: str(formData, "legalName"),
    tradeName: str(formData, "tradeName"),
    street1: str(formData, "street1"),
    street2: str(formData, "street2"),
    city: str(formData, "city"),
    province: str(formData, "province"),
    postalCode: str(formData, "postalCode"),
    country: str(formData, "country") || "Canada",
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    website: str(formData, "website"),
    rbqLicence: str(formData, "rbqLicence"),
    neq: str(formData, "neq"),
    taxRegistered: formData.get("taxRegistered") !== null,
    gstNumber: str(formData, "gstNumber"),
    qstNumber: str(formData, "qstNumber"),
    opcPermit: str(formData, "opcPermit"),
  };

  // Ticking "registered" without the numbers produces documents that cannot be
  // compliant — Revenu Québec requires both on any invoice of $100 or more.
  // Caught here rather than at render time, when a customer is already looking
  // at it.
  if (company.taxRegistered && (!company.gstNumber || !company.qstNumber)) {
    return {
      error:
        "Enter both the GST and QST registration numbers, or untick “registered” — an invoice needs both.",
    };
  }

  try {
    await writeSetting("company", company);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/quotes");
  return { ok: "Saved" };
}

export async function saveQuoteDefaultsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();

  const depositKind = str(formData, "depositKind");
  const validDays = Number(str(formData, "validDays"));

  const defaults: QuoteDefaultsSetting = {
    // Clamped: a quote valid for zero days is expired on arrival, and one
    // valid for three years is a price you no longer want to honour.
    validDays: Number.isFinite(validDays) ? Math.min(365, Math.max(1, Math.round(validDays))) : 30,
    depositKind: depositKind === "amount" || depositKind === "percent" ? depositKind : "none",
    depositValue: Math.max(0, Math.round(Number(str(formData, "depositValue")) || 0)),
    requireSignature: formData.get("requireSignature") !== null,
    showQuantities: formData.get("showQuantities") !== null,
    showUnitPrices: formData.get("showUnitPrices") !== null,
    showLineTotals: formData.get("showLineTotals") !== null,
    showTotalsFooter: formData.get("showTotalsFooter") !== null,
    clientMessageFr: str(formData, "clientMessageFr").slice(0, 5000),
    clientMessageEn: str(formData, "clientMessageEn").slice(0, 5000),
    contractTermsFr: str(formData, "contractTermsFr").slice(0, 20_000),
    contractTermsEn: str(formData, "contractTermsEn").slice(0, 20_000),
  };

  try {
    await writeSetting("quote_defaults", defaults);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }

  revalidatePath("/admin/settings");
  return { ok: "Saved" };
}
