import { describe, expect, it } from "vitest";
import {
  isFieldVisible,
  visibleFields,
  CLAIM_FIELD_TEMPLATE,
  DEFAULT_CUSTOM_FIELDS,
  type CustomFieldDef,
} from "./settings";

/**
 * Conditional claim fields.
 *
 * The failure this guards against is a form that asks a nonsense question and
 * gets a confident answer: "Category of water" after a fire loss will be
 * filled in by somebody, and then it is on the claim.
 */

describe("isFieldVisible", () => {
  const category = CLAIM_FIELD_TEMPLATE.find((f) => f.id === "water_category")!;

  it("shows an unconditional field always", () => {
    const plain: CustomFieldDef = { id: "x", label: "X", type: "text" };
    expect(isFieldVisible(plain, {})).toBe(true);
  });

  it("hides a conditional field until its trigger matches", () => {
    expect(isFieldVisible(category, {})).toBe(false);
    expect(isFieldVisible(category, { loss_type: "Fire" })).toBe(false);
    expect(isFieldVisible(category, { loss_type: "Water" })).toBe(true);
  });

  it("matches the trigger exactly, not loosely", () => {
    // "Water damage" is not "Water" — a near-miss must not open the field,
    // or the option list and the condition drift apart unnoticed.
    expect(isFieldVisible(category, { loss_type: "Water damage" })).toBe(false);
    expect(isFieldVisible(category, { loss_type: "water" })).toBe(false);
  });
});

describe("the claim template", () => {
  it("asks for category and class only on a water loss", () => {
    const onFire = visibleFields(CLAIM_FIELD_TEMPLATE, { loss_type: "Fire" }).map((f) => f.id);
    expect(onFire).not.toContain("water_category");
    expect(onFire).not.toContain("water_class");

    const onWater = visibleFields(CLAIM_FIELD_TEMPLATE, { loss_type: "Water" }).map((f) => f.id);
    expect(onWater).toContain("water_category");
    expect(onWater).toContain("water_class");
  });

  it("asks what happened only when the loss is Other", () => {
    expect(
      visibleFields(CLAIM_FIELD_TEMPLATE, { loss_type: "Other" }).map((f) => f.id),
    ).toContain("loss_type_other");
    expect(
      visibleFields(CLAIM_FIELD_TEMPLATE, { loss_type: "Water" }).map((f) => f.id),
    ).not.toContain("loss_type_other");
  });

  it("always asks the claim identifiers, whatever the loss", () => {
    for (const loss of ["Water", "Fire", "Trauma", ""]) {
      const ids = visibleFields(CLAIM_FIELD_TEMPLATE, { loss_type: loss }).map((f) => f.id);
      expect(ids).toContain("claim_number");
      expect(ids).toContain("carrier_name");
      expect(ids).toContain("adjuster_name");
    }
  });

  it("every conditional field points at a field that exists", () => {
    // A showIf naming a field that was renamed or removed would hide the
    // dependent field forever, silently.
    const ids = new Set(CLAIM_FIELD_TEMPLATE.map((f) => f.id));
    for (const field of CLAIM_FIELD_TEMPLATE) {
      if (field.showIf) expect(ids.has(field.showIf.field)).toBe(true);
    }
  });

  it("every conditional trigger is a real option of the field it depends on", () => {
    const byId = new Map(CLAIM_FIELD_TEMPLATE.map((f) => [f.id, f]));
    for (const field of CLAIM_FIELD_TEMPLATE) {
      if (!field.showIf) continue;
      const parent = byId.get(field.showIf.field)!;
      for (const value of field.showIf.equals) {
        expect(parent.options ?? []).toContain(value);
      }
    }
  });

  it("carries the IICRC categories and classes an adjuster expects", () => {
    const category = CLAIM_FIELD_TEMPLATE.find((f) => f.id === "water_category")!;
    expect(category.options?.length).toBe(4);
    expect(category.options?.[0]).toMatch(/CAT 1/);
    const cls = CLAIM_FIELD_TEMPLATE.find((f) => f.id === "water_class")!;
    expect(cls.options).toEqual(["Class 1", "Class 2", "Class 3", "Not defined"]);
  });
});

describe("the settings shape", () => {
  it("has a project bucket, so a claim is not stored on the customer", () => {
    // A customer with two losses would otherwise overwrite their own claim.
    expect(DEFAULT_CUSTOM_FIELDS.project).toEqual([]);
  });
});
