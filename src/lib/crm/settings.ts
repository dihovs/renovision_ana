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

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "multiselect";

export type CustomFieldDef = {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  showOnQuote?: boolean;
  required?: boolean;
  /**
   * Conditional display: show this field only when another field holds one
   * of `equals`. This is what keeps a claim form honest — Category of Water
   * is a meaningful question after "Type of Loss: Water" and a nonsense one
   * after "Fire", and a form that asks it anyway gets answered anyway.
   */
  showIf?: { field: string; equals: string[] };
};

export type CustomFieldsSetting = {
  client: CustomFieldDef[];
  property: CustomFieldDef[];
  quote: CustomFieldDef[];
  project: CustomFieldDef[];
};

export const DEFAULT_CUSTOM_FIELDS: CustomFieldsSetting = {
  client: [],
  property: [],
  quote: [],
  project: [],
};

/**
 * The claim fields an adjuster expects, ready to apply to a project.
 *
 * This is IICRC S500 vocabulary, and it is not decoration: Renovision does
 * direct insurance work, so these are the data a carrier needs before they
 * will pay. Category is contamination (1 clean, 2 grey, 3 black); Class is
 * evaporation load — together they decide what drying is owed.
 *
 * Offered as a template rather than forced on every project, because a
 * private-pay renovation has no claim number and should not be asked for one.
 */
export const CLAIM_FIELD_TEMPLATE: CustomFieldDef[] = [
  { id: "job_number", label: "Job number", type: "text" },
  // The address the loss happened at, which is not always the address on the
  // client record — a landlord's claim is for a property they do not live in.
  { id: "loss_address", label: "Address of loss", type: "text" },
  { id: "carrier_name", label: "Carrier name", type: "text" },
  { id: "claim_number", label: "Insurance claim number", type: "text" },
  { id: "policy_number", label: "Policy number", type: "text" },
  { id: "adjuster_name", label: "Adjuster name", type: "text" },
  { id: "adjuster_email", label: "Adjuster email", type: "text" },
  { id: "adjuster_phone", label: "Adjuster phone", type: "text" },
  {
    id: "property_type",
    label: "Property type",
    type: "select",
    options: ["Residential", "Commercial"],
  },
  {
    id: "loss_type",
    label: "Type of loss",
    type: "select",
    options: ["Water", "Fire", "Vehicle impact", "Trauma", "Environmental", "Other"],
    required: true,
  },
  {
    id: "water_category",
    label: "Category of water",
    type: "select",
    options: ["CAT 1 — clean", "CAT 2 — grey", "CAT 3 — black", "Not defined"],
    showIf: { field: "loss_type", equals: ["Water"] },
  },
  {
    id: "water_class",
    label: "Class of water",
    type: "select",
    options: ["Class 1", "Class 2", "Class 3", "Not defined"],
    showIf: { field: "loss_type", equals: ["Water"] },
  },
  {
    id: "loss_type_other",
    label: "Describe the loss",
    type: "text",
    showIf: { field: "loss_type", equals: ["Other"] },
  },
  { id: "loss_date", label: "Date of loss", type: "date" },
  { id: "date_contacted", label: "Date contacted", type: "date" },
];

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
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

/**
 * The company's own identity, as it appears on documents.
 *
 * `taxRegistered` is a hard gate, not a preference. GST/QST registration is
 * mandatory only once worldwide taxable supplies pass $30,000 in a calendar
 * quarter or the four preceding quarters; below that a small supplier "is not
 * required to collect the taxes" — and collecting them anyway means taking
 * money you have no authority to take. So when this is false the renderer
 * suppresses tax lines entirely, whatever the per-line taxable flags say.
 *
 * Source: Revenu Québec, "Registering for the GST and the QST".
 */
export type CompanySetting = {
  legalName: string;
  tradeName: string;
  street1: string;
  street2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  /** Building Act s. 57.1 — required on advertising, estimates, quotes,
   *  contracts and statements of account. Omitting it is a penal offence. */
  rbqLicence: string;
  neq: string;
  taxRegistered: boolean;
  gstNumber: string;
  qstNumber: string;
  /** Office de la protection du consommateur permit, needed only if the
   *  company ever concludes itinerant-merchant contracts. */
  opcPermit: string;
};

export const DEFAULT_COMPANY: CompanySetting = {
  legalName: "",
  tradeName: "Renovision AnA",
  street1: "",
  street2: "",
  city: "Laval",
  province: "QC",
  postalCode: "",
  country: "Canada",
  phone: "",
  email: "",
  website: "",
  rbqLicence: "",
  neq: "",
  taxRegistered: false,
  gstNumber: "",
  qstNumber: "",
  opcPermit: "",
};

export type QuoteDefaultsSetting = {
  validDays: number;
  depositKind: "none" | "amount" | "percent";
  depositValue: number;
  requireSignature: boolean;
  showQuantities: boolean;
  showUnitPrices: boolean;
  showLineTotals: boolean;
  showTotalsFooter: boolean;
  /** French is the source text. Under CPA s. 26, where a French and a
   *  non-French version diverge, the reading most favourable to the consumer
   *  prevails — so the two must never say different things. */
  clientMessageFr: string;
  clientMessageEn: string;
  contractTermsFr: string;
  contractTermsEn: string;
};

export const DEFAULT_QUOTE_DEFAULTS: QuoteDefaultsSetting = {
  validDays: 30,
  depositKind: "none",
  depositValue: 0,
  requireSignature: false,
  showQuantities: true,
  showUnitPrices: true,
  showLineTotals: true,
  showTotalsFooter: true,
  clientMessageFr: "",
  clientMessageEn: "",
  contractTermsFr: "",
  contractTermsEn: "",
};

export function getTaxRates(): Promise<TaxRatesSetting> {
  return readSetting("tax_rates", DEFAULT_TAX_RATES);
}

export async function getCompany(): Promise<CompanySetting> {
  // Merged over the defaults rather than returned raw: a settings row written
  // before a field existed would otherwise come back missing that key, and
  // `company.rbqLicence` would be undefined rather than "".
  const stored = await readSetting("company", {} as Partial<CompanySetting>);
  return { ...DEFAULT_COMPANY, ...stored };
}

export async function getQuoteDefaults(): Promise<QuoteDefaultsSetting> {
  const stored = await readSetting("quote_defaults", {} as Partial<QuoteDefaultsSetting>);
  return { ...DEFAULT_QUOTE_DEFAULTS, ...stored };
}

/**
 * Whether tax may legally be charged at all.
 *
 * Both numbers must be present, not just the flag: a company that has ticked
 * "registered" but not entered its numbers cannot produce a compliant invoice
 * anyway, since Revenu Québec requires both to appear on any invoice of $100
 * or more.
 */
export function canChargeTax(company: CompanySetting): boolean {
  return Boolean(company.taxRegistered && company.gstNumber.trim() && company.qstNumber.trim());
}

export function getLeadSources(): Promise<string[]> {
  return readSetting("lead_sources", DEFAULT_LEAD_SOURCES);
}

export async function getCustomFields(): Promise<CustomFieldsSetting> {
  const stored = await readSetting("custom_fields", DEFAULT_CUSTOM_FIELDS);
  // Merged rather than returned raw: a settings row written before `project`
  // existed has no such key, and every caller maps over these arrays. One
  // undefined here is a crashed settings screen.
  return { ...DEFAULT_CUSTOM_FIELDS, ...stored };
}

/**
 * Whether a field should be asked, given the answers so far.
 *
 * A hidden field's stored value is deliberately left alone rather than
 * cleared — switching Type of Loss to Fire and back to Water should not have
 * silently destroyed the category somebody already recorded.
 */
export function isFieldVisible(
  field: CustomFieldDef,
  values: Record<string, string>,
): boolean {
  if (!field.showIf) return true;
  return field.showIf.equals.includes(values[field.showIf.field] ?? "");
}

/** The fields actually asked, in order, for a given set of answers. */
export function visibleFields(
  fields: CustomFieldDef[],
  values: Record<string, string>,
): CustomFieldDef[] {
  return fields.filter((field) => isFieldVisible(field, values));
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
