"use client";

import { useId } from "react";
import { isFieldVisible, type CustomFieldDef } from "@/lib/crm/settings";

/**
 * Render a set of custom fields, honouring conditional display.
 *
 * Controlled rather than uncontrolled, unlike the older per-field inputs on
 * the client form: a conditional field's visibility depends on the CURRENT
 * value of another field, so the answers have to live above the inputs. That
 * is the whole reason this exists as its own component.
 */
export default function CustomFieldList({
  fields,
  values,
  onChange,
  namePrefix = "custom__",
}: {
  fields: CustomFieldDef[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Posted as `${namePrefix}${field.id}`, matching the existing forms. */
  namePrefix?: string;
}) {
  const id = useId();

  function set(fieldId: string, value: string) {
    onChange({ ...values, [fieldId]: value });
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const visible = isFieldVisible(field, values);
        const value = values[field.id] ?? "";
        const inputId = `${id}-${field.id}`;

        // A hidden field still posts its stored value, so switching Type of
        // Loss away and back does not silently destroy an answer somebody
        // already recorded.
        if (!visible) {
          return (
            <input
              key={field.id}
              type="hidden"
              name={`${namePrefix}${field.id}`}
              value={value}
            />
          );
        }

        return (
          <div key={field.id}>
            <label htmlFor={inputId} className="mb-1 block text-xs font-semibold text-charcoal/70">
              {field.label}
              {field.required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {field.type === "select" ? (
              <select
                id={inputId}
                name={`${namePrefix}${field.id}`}
                value={value}
                required={field.required}
                onChange={(event) => set(field.id, event.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "multiselect" ? (
              <div className="flex flex-wrap gap-1.5">
                {(field.options ?? []).map((option) => {
                  const chosen = value.split("|").filter(Boolean);
                  const on = chosen.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          field.id,
                          (on ? chosen.filter((c) => c !== option) : [...chosen, option]).join("|"),
                        )
                      }
                      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                        on ? "bg-brand-blue text-white" : "bg-black/[0.05] text-charcoal/55"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
                <input type="hidden" name={`${namePrefix}${field.id}`} value={value} />
              </div>
            ) : field.type === "checkbox" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
                <input
                  id={inputId}
                  type="checkbox"
                  name={`${namePrefix}${field.id}`}
                  value="yes"
                  checked={value === "yes"}
                  onChange={(event) => set(field.id, event.target.checked ? "yes" : "")}
                  className="h-4 w-4 cursor-pointer accent-brand-blue"
                />
                Yes
              </label>
            ) : (
              <input
                id={inputId}
                name={`${namePrefix}${field.id}`}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={value}
                required={field.required}
                onChange={(event) => set(field.id, event.target.value)}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";
