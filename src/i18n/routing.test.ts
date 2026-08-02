import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isLocale,
  isUnlocalizedPath,
  localePath,
  localizeHref,
  splitLocale,
  toLocale,
} from "./routing";

describe("localePath", () => {
  it("leaves French unprefixed — every indexed URL keeps its exact shape", () => {
    expect(localePath("fr", "/services/water-damage")).toBe("/services/water-damage");
    expect(localePath("fr", "/")).toBe("/");
  });

  it("puts English one directory deeper", () => {
    expect(localePath("en", "/services/water-damage")).toBe("/en/services/water-damage");
    expect(localePath("en", "/")).toBe("/en");
  });

  it("defaults to the site root", () => {
    expect(localePath("fr")).toBe("/");
    expect(localePath("en")).toBe("/en");
  });
});

describe("splitLocale", () => {
  it("reads the English prefix", () => {
    expect(splitLocale("/en/blog")).toEqual({ locale: "en", path: "/blog" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
  });

  it("treats an unprefixed path as French", () => {
    expect(splitLocale("/blog")).toEqual({ locale: "fr", path: "/blog" });
    expect(splitLocale("/")).toEqual({ locale: "fr", path: "/" });
  });

  it("also strips /fr, so it reads the same whether given the browser path or the rewritten one", () => {
    // proxy.ts rewrites `/blog` to `/fr/blog` internally; the toggle must
    // produce the same counterpart URL either way.
    expect(splitLocale("/fr/blog")).toEqual({ locale: "fr", path: "/blog" });
    expect(splitLocale("/fr")).toEqual({ locale: "fr", path: "/" });
  });

  it("does not mistake a path that merely starts with the prefix letters", () => {
    expect(splitLocale("/energy")).toEqual({ locale: "fr", path: "/energy" });
    expect(splitLocale("/frames")).toEqual({ locale: "fr", path: "/frames" });
  });

  it("round-trips with localePath", () => {
    for (const path of ["/", "/blog", "/services/water-damage", "/service-areas/chomedey"]) {
      expect(splitLocale(localePath("en", path)).path).toBe(path);
      expect(splitLocale(localePath("fr", path)).path).toBe(path);
    }
  });
});

describe("localizeHref", () => {
  it("prefixes internal links for English and leaves them alone for French", () => {
    expect(localizeHref("en", "/contact")).toBe("/en/contact");
    expect(localizeHref("fr", "/contact")).toBe("/contact");
  });

  it("keeps the query string and hash", () => {
    expect(localizeHref("en", "/contact?ref=footer")).toBe("/en/contact?ref=footer");
    expect(localizeHref("en", "/services#list")).toBe("/en/services#list");
    expect(localizeHref("en", "/#top")).toBe("/en#top");
  });

  it("does not touch anything that leaves the site", () => {
    expect(localizeHref("en", "tel:+15799903077")).toBe("tel:+15799903077");
    expect(localizeHref("en", "mailto:info@renovisionana.ca")).toBe("mailto:info@renovisionana.ca");
    expect(localizeHref("en", "https://example.com/x")).toBe("https://example.com/x");
    expect(localizeHref("en", "//cdn.example.com/x")).toBe("//cdn.example.com/x");
  });
});

describe("isUnlocalizedPath", () => {
  it("covers the private, token and generated-image surfaces", () => {
    for (const path of [
      "/admin",
      "/admin/quotes/42",
      "/api/leads",
      "/hub/abc",
      "/q/abc",
      "/i/abc",
      "/opengraph-image",
    ]) {
      expect(isUnlocalizedPath(path)).toBe(true);
    }
  });

  it("leaves the marketing tree alone, including paths that share a first letter", () => {
    for (const path of ["/", "/en", "/services", "/estimation", "/about", "/insulation", "/quebec"]) {
      expect(isUnlocalizedPath(path)).toBe(false);
    }
  });
});

describe("locale narrowing", () => {
  it("recognises only the two real locales", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("falls back to French, never to English", () => {
    expect(toLocale("de")).toBe("fr");
    expect(toLocale(undefined)).toBe("fr");
    expect(DEFAULT_LOCALE).toBe("fr");
  });
});
