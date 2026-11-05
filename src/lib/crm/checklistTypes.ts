/**
 * Checklist templates and submissions — the shapes and their rules. Pure, no
 * database, so the template builder and the crew form (client components)
 * share the exact validation the server applies. Database side:
 * checklists.ts. Migration 0056.
 */

export const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "checkbox",
  "dropdown",
  "link",
  "signature",
  "photo",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text",
  long_text: "Notes",
  number: "Number",
  checkbox: "Yes / no",
  dropdown: "Pick one",
  link: "Link",
  signature: "Signature",
  photo: "Photo",
};

export type ChecklistField = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  /** Dropdown choices; ignored for every other type. */
  options?: string[];
  /** A unit shown after a number ("%", "ft", "°C"). */
  unit?: string;
};

export type ChecklistSection = { id: string; title: string; fields: ChecklistField[] };

/** What a submission stores per field. Photos are a list of data URLs. */
export type FieldValue = string | number | boolean | string[] | null;
export type ChecklistValues = Record<string, FieldValue>;

export const MAX_SECTIONS = 30;
export const MAX_FIELDS = 200;
export const MAX_PHOTOS_PER_FIELD = 4;
/** Per image, after shrinking on the phone. A 1024px JPEG at 0.7 is ~150 kB. */
export const MAX_IMAGE_CHARS = 700_000;

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newField(type: FieldType = "checkbox"): ChecklistField {
  return { id: shortId(), type, label: "", required: false, ...(type === "dropdown" ? { options: [] } : {}) };
}

export function newSection(title = ""): ChecklistSection {
  return { id: shortId(), title, fields: [newField()] };
}

/**
 * Turn whatever was posted into a clean template, or say what is wrong.
 * Unknown types become notes, blank labels are refused, dropdowns need
 * choices, ids are kept (so submissions still line up) or made.
 */
export function cleanSections(input: unknown): { sections: ChecklistSection[]; errors: string[] } {
  const errors: string[] = [];
  const raw = Array.isArray(input) ? input : [];
  if (raw.length > MAX_SECTIONS) errors.push(`At most ${MAX_SECTIONS} sections.`);
  const seen = new Set<string>();
  let fieldCount = 0;

  const sections = raw.slice(0, MAX_SECTIONS).map((s, si): ChecklistSection => {
    const section = (s ?? {}) as Partial<ChecklistSection>;
    const fields = (Array.isArray(section.fields) ? section.fields : []).map((f, fi): ChecklistField => {
      fieldCount += 1;
      const field = (f ?? {}) as Partial<ChecklistField>;
      const type: FieldType = (FIELD_TYPES as readonly string[]).includes(field.type ?? "")
        ? (field.type as FieldType)
        : "long_text";
      let id = typeof field.id === "string" && /^[\w-]{1,40}$/.test(field.id) ? field.id : shortId();
      while (seen.has(id)) id = shortId();
      seen.add(id);
      const label = String(field.label ?? "").trim().slice(0, 200);
      if (!label) errors.push(`Section ${si + 1}, field ${fi + 1} needs a label.`);
      const out: ChecklistField = { id, type, label, required: Boolean(field.required) };
      if (type === "dropdown") {
        const options = (Array.isArray(field.options) ? field.options : [])
          .map((o) => String(o).trim().slice(0, 100))
          .filter(Boolean);
        if (options.length < 2) errors.push(`“${label || "A dropdown"}” needs at least two choices.`);
        out.options = [...new Set(options)].slice(0, 50);
      }
      if (type === "number" && field.unit) out.unit = String(field.unit).trim().slice(0, 12);
      return out;
    });
    return {
      id: typeof section.id === "string" && /^[\w-]{1,40}$/.test(section.id) ? section.id : shortId(),
      title: String(section.title ?? "").trim().slice(0, 120),
      fields,
    };
  });

  if (fieldCount > MAX_FIELDS) errors.push(`At most ${MAX_FIELDS} fields.`);
  if (fieldCount === 0) errors.push("Add at least one field.");
  return { sections, errors };
}

function isBlank(value: FieldValue | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Check a filled form against its checklist and keep only what belongs.
 * Values for fields that are not on the form are dropped; each value is
 * coerced to its field's type; required fields must be answered (a required
 * yes/no must be ticked — "confirm the water is off").
 */
export function cleanValues(
  sections: ChecklistSection[],
  input: Record<string, unknown>,
): { values: ChecklistValues; errors: string[] } {
  const values: ChecklistValues = {};
  const errors: string[] = [];

  for (const field of sections.flatMap((s) => s.fields)) {
    const raw = input?.[field.id];
    let value: FieldValue = null;
    const before = errors.length;

    switch (field.type) {
      case "checkbox":
        value = raw === true || raw === "true" || raw === "on";
        if (field.required && value !== true) errors.push(`“${field.label}” must be confirmed.`);
        values[field.id] = value;
        continue;
      case "number": {
        if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
          const n = Number(String(raw).replace(",", "."));
          if (Number.isFinite(n)) value = n;
          else errors.push(`“${field.label}” must be a number.`);
        }
        break;
      }
      case "dropdown": {
        const s = typeof raw === "string" ? raw : "";
        if (s && !(field.options ?? []).includes(s)) errors.push(`“${field.label}”: pick one of the choices.`);
        else value = s || null;
        break;
      }
      case "link": {
        const s = typeof raw === "string" ? raw.trim() : "";
        if (s && !/^https?:\/\/\S+$/i.test(s)) errors.push(`“${field.label}” must be a web link (https://…).`);
        else value = s || null;
        break;
      }
      case "signature": {
        const s = typeof raw === "string" ? raw : "";
        if (s && !(s.startsWith("data:image/") && s.length <= MAX_IMAGE_CHARS)) {
          errors.push(`“${field.label}”: the signature could not be read. Sign again.`);
        } else value = s || null;
        break;
      }
      case "photo": {
        const list = (Array.isArray(raw) ? raw : [])
          .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/") && p.length <= MAX_IMAGE_CHARS)
          .slice(0, MAX_PHOTOS_PER_FIELD);
        value = list.length ? list : null;
        break;
      }
      default: {
        const s = typeof raw === "string" ? raw.trim() : "";
        value = s ? s.slice(0, field.type === "long_text" ? 5000 : 500) : null;
      }
    }

    // One message per field: a value already refused is not also "missing".
    if (field.required && isBlank(value) && errors.length === before) errors.push(`“${field.label}” is required.`);
    values[field.id] = value;
  }

  return { values, errors };
}

/** How much of a form is answered — for the "3 of 8" on a checklist card. */
export function answeredCount(sections: ChecklistSection[], values: ChecklistValues): { answered: number; total: number } {
  const fields = sections.flatMap((s) => s.fields);
  const answered = fields.filter((f) => (f.type === "checkbox" ? values[f.id] === true : !isBlank(values[f.id]))).length;
  return { answered, total: fields.length };
}
