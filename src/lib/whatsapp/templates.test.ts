import { describe, expect, it } from "vitest";
import { componentsFor, freeFormBody, sanitiseParam, templateName } from "./templates";

/**
 * The template contract with Meta, which is enforced on their side and only
 * describable on ours.
 *
 * Every case here is one Meta rejects at send time with an error code and no
 * useful message — a newline in a parameter, a URL in the body, the button
 * index as a number rather than a string. They are cheap to get right and
 * invisible until a dispatch silently does not go out.
 */

const PARAMS = {
  jobNumber: "1042",
  arrivalWindow: "lundi 4 août, 8 h – 10 h",
  street: "1450 rue Fleury Est, Montréal",
  token: "a3f9c2b17d4e5f6081a2b3c4d5e6f708",
};

describe("sanitiseParam", () => {
  it("flattens the newline Meta rejects with 132012", () => {
    expect(sanitiseParam("1450 rue Fleury\nMontréal")).toBe("1450 rue Fleury Montréal");
  });

  it("collapses tabs and runs of spaces", () => {
    expect(sanitiseParam("8 h\t\t–     10 h")).toBe("8 h – 10 h");
  });

  it("trims, because a leading space is also a rejection", () => {
    expect(sanitiseParam("  Montréal  ")).toBe("Montréal");
  });
});

describe("componentsFor", () => {
  const components = componentsFor(PARAMS);

  it("names its body parameters, so reordering cannot swap the address into the time", () => {
    const body = components[0] as { type: string; parameters: { parameter_name: string; text: string }[] };
    expect(body.type).toBe("body");
    expect(body.parameters.map((p) => p.parameter_name)).toEqual([
      "job_number",
      "arrival_window",
      "street",
    ]);
  });

  it("sends the token as the button suffix and never in the body", () => {
    const body = JSON.stringify(components[0]);
    expect(body).not.toContain(PARAMS.token);

    const button = components[1] as {
      type: string;
      sub_type: string;
      index: string;
      parameters: { text: string }[];
    };
    expect(button.sub_type).toBe("url");
    // A number here is silently wrong: Meta wants the string.
    expect(button.index).toBe("0");
    expect(button.parameters[0].text).toBe(PARAMS.token);
  });

  it("puts no URL in a body parameter — Meta refuses one outright", () => {
    expect(JSON.stringify(components[0])).not.toMatch(/https?:\/\//);
  });

  it("carries no price, and no field one could travel in", () => {
    const all = JSON.stringify(components);
    expect(all).not.toMatch(/\$|cents|price|prix|total/i);
  });
});

describe("templateName", () => {
  it("maps both kinds to the two approved templates", () => {
    expect(templateName("scheduled")).toBe("job_scheduled");
    expect(templateName("schedule_changed")).toBe("schedule_changed");
  });
});

describe("freeFormBody", () => {
  it("carries the link, which is legal here and not in a template body", () => {
    const body = freeFormBody("scheduled", PARAMS, "https://www.renovisionana.ca/crew/abc", "fr");
    expect(body).toContain("https://www.renovisionana.ca/crew/abc");
    expect(body).toContain("Chantier 1042");
  });

  it("says the schedule changed when that is what happened", () => {
    const fr = freeFormBody("schedule_changed", PARAMS, "https://x/y", "fr");
    const en = freeFormBody("schedule_changed", PARAMS, "https://x/y", "en");
    expect(fr).toContain("l'horaire a changé");
    expect(en).toContain("the schedule has changed");
  });
});
