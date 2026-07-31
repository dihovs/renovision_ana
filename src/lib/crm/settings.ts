import { db, isMissingTable } from "./db";

/**
 * Configurable settings — the things the owner can change without a developer.
 *
 * Every getter falls back to a built-in default rather than throwing, so the
 * CRM works before the settings row exists and keeps working if one is deleted.
 * A missing tax rate must never silently mean "no tax".
 */

/**
 * Rates are hundredths of a basis point, so 9.975% is 99750.
 *
 * Quebec's QST rate has three decimal places. Percent-as-float loses cents on
 * large jobs and, worse, loses them inconsistently — the same subtotal can
 * round differently depending on how it was reached. Integers do not.
 */
export const RATE_SCALE = 1_000_000;

export type TaxComponent = {
  name: string;
  /** Hundredths of a basis point — divide by RATE_SCALE for a multiplier. */
  rate: number;
  /** GST/QST registration number, printed on the quote. */
  registration?: string;
};

export type TaxRate = {
  id: string;
  label: string;
  components: TaxComponent[];
};

export type TaxRatesSetting = {
  default: string;
  rates: TaxRate[];
};

export const DEFAULT_TAX_RATES: TaxRatesSetting = {
  default: "qc",
  rates: [
    {
      id: "qc",
      label: "GST + QST (Quebec)",
      components: [
        { name: "GST", rate: 50_000, registration: "" },
        { name: "QST", rate: 99_750, registration: "" },
      ],
    },
    { id: "exempt", label: "No tax", components: [] },
  ],
};

export const DEFAULT_LEAD_SOURCES = [
  "Website",
  "Google",
  "Referral",
  "Repeat client",
  "Facebook",
  "Instagram",
  "Phone",
  "Insurance",
  "Other",
];

export type CustomFieldType = "text" | "number" | "date" | "checkbox" | "select";

export type CustomFieldDef = {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  showOnQuote?: boolean;
};

export type CustomFieldsSetting = {
  client: CustomFieldDef[];
  property: CustomFieldDef[];
  quote: CustomFieldDef[];
};

export const DEFAULT_CUSTOM_FIELDS: CustomFieldsSetting = {
  client: [],
  property: [],
  quote: [],
};

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const client = db();
  if (!client) return fallback;
  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    // A missing table means the migration hasn't run. Every other error is
    // worth seeing in the logs, but neither should take the page down when a
    // usable default exists.
    if (!isMissingTable(error)) console.error(`[settings] read ${key} failed:`, error.message);
    return fallback;
  }
  return (data?.value as T) ?? fallback;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { error } = await client
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`Could not save ${key}: ${error.message}`);
}

export function getTaxRates(): Promise<TaxRatesSetting> {
  return readSetting("tax_rates", DEFAULT_TAX_RATES);
}

export function getLeadSources(): Promise<string[]> {
  return readSetting("lead_sources", DEFAULT_LEAD_SOURCES);
}

export function getCustomFields(): Promise<CustomFieldsSetting> {
  return readSetting("custom_fields", DEFAULT_CUSTOM_FIELDS);
}

/**
 * Resolve the rate that actually applies, following property → client →
 * account default. Returns the account default if the named rate has since
 * been deleted, because a quote referencing a rate that no longer exists must
 * still total to something defensible.
 */
export function resolveTaxRate(
  setting: TaxRatesSetting,
  ...preferences: (string | null | undefined)[]
): TaxRate {
  for (const id of preferences) {
    if (!id) continue;
    const match = setting.rates.find((r) => r.id === id);
    if (match) return match;
  }
  return (
    setting.rates.find((r) => r.id === setting.default) ??
    setting.rates[0] ?? { id: "exempt", label: "No tax", components: [] }
  );
}

/** "14.975%" — for display next to a total. */
export function formatRate(rate: TaxRate): string {
  const total = rate.components.reduce((sum, c) => sum + c.rate, 0);
  if (total === 0) return "0%";
  const percent = (total / RATE_SCALE) * 100;
  return `${percent.toFixed(3).replace(/\.?0+$/, "")}%`;
}
