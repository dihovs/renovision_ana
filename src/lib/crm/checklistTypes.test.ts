import { describe, expect, it } from "vitest";
import { answeredCount, cleanSections, cleanValues, type ChecklistSection } from "./checklistTypes";

const FORM: ChecklistSection[] = [
  {
    id: "s1",
    title: "Drying set-up",
    fields: [
      { id: "water_off", type: "checkbox", label: "Water supply is off", required: true },
      { id: "reading", type: "number", label: "Wall reading", required: true, unit: "%" },
      { id: "room", type: "dropdown", label: "Room", required: false, options: ["Kitchen", "Bathroom"] },
      { id: "notes", type: "long_text", label: "Notes", required: false },
      { id: "sign", type: "signature", label: "Customer signature", required: true },
      { id: "pics", type: "photo", label: "Meter photo", required: false },
    ],
  },
];

describe("checklist templates", () => {
  it("refuses blank labels and one-choice dropdowns", () => {
    const { errors } = cleanSections([
      { title: "A", fields: [{ type: "text", label: "" }, { type: "dropdown", label: "Pick", options: ["only"] }] },
    ]);
    expect(errors).toEqual(["Section 1, field 1 needs a label.", "“Pick” needs at least two choices."]);
  });

  it("keeps field ids so old submissions still line up, and makes duplicates unique", () => {
    const { sections } = cleanSections([
      { id: "s", title: "A", fields: [{ id: "x", type: "text", label: "One" }, { id: "x", type: "text", label: "Two" }] },
    ]);
    expect(sections[0].fields[0].id).toBe("x");
    expect(sections[0].fields[1].id).not.toBe("x");
  });

  it("turns an unknown type into notes rather than dropping the field", () => {
    const { sections } = cleanSections([{ title: "A", fields: [{ type: "laser", label: "Thing" }] }]);
    expect(sections[0].fields[0].type).toBe("long_text");
  });

  it("needs at least one field", () => {
    expect(cleanSections([]).errors).toContain("Add at least one field.");
  });
});

describe("checklist submissions", () => {
  const sig = "data:image/png;base64,AAAA";

  it("accepts a complete form and coerces each type", () => {
    const { values, errors } = cleanValues(FORM, {
      water_off: true,
      reading: "17,5",
      room: "Kitchen",
      notes: "  dry by Friday ",
      sign: sig,
      pics: [sig, 42, "not an image"],
      stray: "dropped",
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({ water_off: true, reading: 17.5, room: "Kitchen", notes: "dry by Friday", sign: sig, pics: [sig] });
  });

  it("a required yes/no must be ticked, and required fields answered", () => {
    const { errors } = cleanValues(FORM, { reading: "", sign: "" });
    expect(errors).toEqual([
      "“Water supply is off” must be confirmed.",
      "“Wall reading” is required.",
      "“Customer signature” is required.",
    ]);
  });

  it("refuses a choice that is not on the list and a number that is not one", () => {
    const { errors } = cleanValues(FORM, { water_off: true, reading: "wet", room: "Garage", sign: sig });
    expect(errors).toEqual(["“Wall reading” must be a number.", "“Room”: pick one of the choices."]);
  });

  it("counts what is answered", () => {
    expect(answeredCount(FORM, { water_off: true, reading: 12, room: null })).toEqual({ answered: 2, total: 6 });
  });
});
