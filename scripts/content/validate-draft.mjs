#!/usr/bin/env node
/**
 * Mechanical check for blog drafts in `content/drafts/*.json`.
 *
 * It catches the errors that are embarrassing — a dead internal link, a meta
 * title Google will truncate, French copy that reads as France rather than
 * Quebec, an FR/EN pair whose sections drifted apart. It cannot tell you the
 * draft is any good; that is the owner gate in `Docs/Content-Engine.md`.
 *
 *   node scripts/content/validate-draft.mjs            # check every draft
 *   node scripts/content/validate-draft.mjs <slug>     # check one
 *   node scripts/content/validate-draft.mjs --emit <slug>
 *
 * `--emit` prints the TypeScript literal to paste into src/lib/blogPosts.ts.
 * Nothing in this script ever writes to src/ — that is deliberate.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DRAFTS = join(ROOT, "content", "drafts");

// Calibrated against the copy already shipped (metaTitles run 39-52 chars,
// descriptions 128-166) rather than against a generic SEO rule of thumb.
const META_TITLE = { min: 38, max: 52, hardMin: 25, hardMax: 60 };
const META_DESC = { min: 130, max: 160, hardMin: 110, hardMax: 170 };

const SECTION_TYPES = ["paragraph", "heading", "list", "stats", "linkParagraph", "timeline"];

/** France-only vocabulary and units. See "Quebec, not France" in the engine doc. */
const BANNED = [
  [/\bm²/, "m² — price and measure in $/pi², always"],
  [/€/, "euro sign — this market is CAD"],
  [/\bloi Warsmann\b/i, "loi Warsmann is French law"],
  [/\bgarantie d[ée]cennale\b/i, "garantie décennale is French law"],
  [/\bpermis de construire\b/i, "France; Quebec says « permis de construction »"],
  [/\bTVA\b/, "TVA — Quebec is TPS/TVQ"],
  [/\b(Veolia|SAUR|MAAF)\b/, "France-only company name"],
];

const listFiles = () =>
  existsSync(DRAFTS) ? readdirSync(DRAFTS).filter((f) => f.endsWith(".json")) : [];

/** Slugs already in the shipped file — a draft may not collide with one. */
function shippedSlugs() {
  const src = readFileSync(join(ROOT, "src", "lib", "blogPosts.ts"), "utf8");
  return [...src.matchAll(/^ {4}slug: "([^"]+)"/gm)].map((m) => m[1]);
}

/** Every path a `linkParagraph` is allowed to point at. */
function validRoutes() {
  const routes = new Set();
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("[")) continue; // dynamic segments handled below
      const path = `${prefix}/${entry.name}`;
      const full = join(dir, entry.name);
      if (existsSync(join(full, "page.tsx"))) routes.add(path);
      walk(full, path);
    }
  };
  const base = join(ROOT, "src", "app", "[lang]");
  routes.add("/");
  walk(base);
  const areas = readFileSync(join(ROOT, "src", "lib", "serviceAreas.ts"), "utf8");
  for (const m of areas.matchAll(/^ {4}slug: "([^"]+)"/gm)) routes.add(`/service-areas/${m[1]}`);
  for (const slug of shippedSlugs()) routes.add(`/blog/${slug}`);
  return routes;
}

function checkLocale(post, lang, routes, err, warn) {
  const copy = post[lang];
  const at = (field) => `${lang}.${field}`;
  if (!copy) return err(`${lang} is missing entirely`);

  for (const field of ["title", "metaTitle", "excerpt", "metaDescription", "sections"]) {
    if (!copy[field]) err(`${at(field)} is missing`);
  }
  if (!copy.sections) return;

  const mt = (copy.metaTitle ?? "").length;
  if (mt < META_TITLE.hardMin || mt > META_TITLE.hardMax)
    err(`${at("metaTitle")} is ${mt} chars — outside ${META_TITLE.hardMin}-${META_TITLE.hardMax}`);
  else if (mt < META_TITLE.min || mt > META_TITLE.max)
    warn(`${at("metaTitle")} is ${mt} chars — shipped copy sits at ${META_TITLE.min}-${META_TITLE.max}`);

  const md = (copy.metaDescription ?? "").length;
  if (md < META_DESC.hardMin || md > META_DESC.hardMax)
    err(`${at("metaDescription")} is ${md} chars — outside ${META_DESC.hardMin}-${META_DESC.hardMax}`);
  else if (md < META_DESC.min || md > META_DESC.max)
    warn(`${at("metaDescription")} is ${md} chars — aim for ${META_DESC.min}-${META_DESC.max}`);

  if (copy.excerpt === copy.metaDescription)
    warn(`${at("excerpt")} is identical to the meta description — the card and the SERP snippet should not repeat`);

  copy.sections.forEach((section, i) => {
    if (!SECTION_TYPES.includes(section.type))
      err(`${at(`sections[${i}]`)} has unknown type "${section.type}"`);
    if (section.type === "linkParagraph") {
      const path = (section.href ?? "").split("#")[0].replace(/\/$/, "");
      if (path.startsWith("/") && !routes.has(path))
        err(`${at(`sections[${i}]`)} links to ${section.href} — no such route`);
      if (!section.linkText) err(`${at(`sections[${i}]`)} has no linkText`);
    }
  });

  if (!copy.sections.some((s) => s.type === "heading"))
    err(`${lang} has no heading section — a post with no H2s gives Google nothing to anchor on`);

  const text = JSON.stringify(copy);
  for (const [pattern, why] of BANNED) {
    if (pattern.test(text)) err(`${lang}: ${why}`);
  }
  if (/24\s*\/\s*7/.test(text))
    warn(`${lang} says 24/7 — confirm it means the phone is answered, never overnight crew dispatch`);

  const words = text.split(/\s+/).length;
  const estimate = Math.round(words / 200);
  if (Math.abs(estimate - post.readTimeMinutes) > 2)
    warn(`${lang} reads as ~${estimate} min but readTimeMinutes is ${post.readTimeMinutes}`);
}

function validate(file, routes, shipped) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  let post;
  try {
    post = JSON.parse(readFileSync(join(DRAFTS, file), "utf8"));
  } catch (e) {
    return { file, post: null, errors: [`not valid JSON: ${e.message}`], warnings };
  }

  if (!post.slug) err("slug is missing");
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug))
      err(`slug "${post.slug}" must be lowercase kebab-case with no accents`);
    if (shipped.includes(post.slug)) err(`slug "${post.slug}" is already published`);
    if (file !== `${post.slug}.json`) warn(`filename should be ${post.slug}.json`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt ?? ""))
    err("publishedAt must be a bare YYYY-MM-DD date");
  if (typeof post.readTimeMinutes !== "number") err("readTimeMinutes must be a number");
  if (!post.categoryTag?.en || !post.categoryTag?.fr) err("categoryTag needs both en and fr");
  if (!post.heroStat?.value || !post.heroStat?.label?.en || !post.heroStat?.label?.fr)
    err("heroStat needs a value and both labels — it is the fallback when there is no photo");
  if (post.heroImage && !existsSync(join(ROOT, "public", post.heroImage)))
    err(`heroImage ${post.heroImage} does not exist in public/`);

  checkLocale(post, "fr", routes, err, warn);
  checkLocale(post, "en", routes, err, warn);

  // Structural parity: the two languages must be the same article, not two
  // different ones that happen to share a slug.
  if (post.fr?.sections && post.en?.sections) {
    const fr = post.fr.sections.map((s) => s.type).join(",");
    const en = post.en.sections.map((s) => s.type).join(",");
    if (fr !== en) err(`fr and en sections differ in structure:\n      fr: ${fr}\n      en: ${en}`);
  }

  return { file, post, errors, warnings };
}

function emit(post) {
  const s = (v) => JSON.stringify(v);
  const section = (x) => {
    if (x.type === "list") return `        { type: "list", items: [${x.items.map(s).join(", ")}] },`;
    if (x.type === "stats")
      return `        {\n          type: "stats",\n          items: [\n${x.items
        .map((i) => `            { value: ${s(i.value)}, label: ${s(i.label)} },`)
        .join("\n")}\n          ],\n        },`;
    if (x.type === "timeline")
      return `        {\n          type: "timeline",\n          items: [\n${x.items
        .map((i) => `            { time: ${s(i.time)}, text: ${s(i.text)} },`)
        .join("\n")}\n          ],\n        },`;
    if (x.type === "linkParagraph")
      return `        {\n          type: "linkParagraph",\n          text: ${s(x.text)},\n          linkText: ${s(x.linkText)},\n          href: ${s(x.href)},\n        },`;
    return `        { type: ${s(x.type)}, text: ${s(x.text)} },`;
  };
  const locale = (lang) => `    ${lang}: {
      title: ${s(post[lang].title)},
      metaTitle: ${s(post[lang].metaTitle)},
      excerpt: ${s(post[lang].excerpt)},
      metaDescription: ${s(post[lang].metaDescription)},
      sections: [
${post[lang].sections.map(section).join("\n")}
      ],
    },`;
  return `  {
    slug: ${s(post.slug)},
    categoryTag: { en: ${s(post.categoryTag.en)}, fr: ${s(post.categoryTag.fr)} },
    publishedAt: ${s(post.publishedAt)},
    readTimeMinutes: ${post.readTimeMinutes},${post.heroImage ? `\n    heroImage: ${s(post.heroImage)},` : ""}
    heroStat: {
      value: ${s(post.heroStat.value)},
      label: { en: ${s(post.heroStat.label.en)}, fr: ${s(post.heroStat.label.fr)} },
    },
${locale("en")}
${locale("fr")}
  },`;
}

const args = process.argv.slice(2);
const emitAt = args.indexOf("--emit");
const only = emitAt >= 0 ? args[emitAt + 1] : args[0];

const routes = validRoutes();
const shipped = shippedSlugs();
const files = listFiles().filter((f) => !only || f === `${only}.json` || f === only);

if (files.length === 0) {
  console.log(
    only
      ? `No draft named "${only}" in content/drafts/.`
      : "No drafts in content/drafts/ — nothing to check.",
  );
  process.exit(only ? 1 : 0);
}

const results = files.map((f) => validate(f, routes, shipped));

if (emitAt >= 0) {
  const target = results[0];
  if (target.errors.length > 0) {
    console.error(`Refusing to emit ${target.file} — fix these first:`);
    for (const e of target.errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(emit(target.post));
  process.exit(0);
}

let failed = 0;
for (const r of results) {
  const status = r.errors.length > 0 ? "FAIL" : r.warnings.length > 0 ? "warn" : "ok";
  console.log(`\n${status === "ok" ? "✓" : status === "warn" ? "!" : "✗"} ${r.file} — ${status}`);
  for (const e of r.errors) console.log(`    ✗ ${e}`);
  for (const w of r.warnings) console.log(`    ! ${w}`);
  if (r.errors.length > 0) failed++;
}
console.log(
  `\n${results.length} draft(s) checked, ${failed} failing.` +
    (failed === 0 ? " Mechanical checks only — the owner still reads the French." : ""),
);
process.exit(failed > 0 ? 1 : 0);
