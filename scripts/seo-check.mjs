#!/usr/bin/env node
/**
 * Static SEO configuration validator — npm run seo:check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`seo:check FAIL — ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`seo:check OK — ${msg}`);
}

const {
  SEO_CONFIG,
  getSitemapPaths,
  INDEXABLE_ROUTE_POLICIES,
  NOINDEX_ROUTE_POLICIES,
  absoluteSeoUrl,
  buildSitemapXml,
} = await import("../src/lib/seo/index.ts");

if (SEO_CONFIG.productionOrigin !== "https://www.elcamoso.com") {
  fail(`productionOrigin must be https://www.elcamoso.com, got ${SEO_CONFIG.productionOrigin}`);
} else {
  ok("production origin");
}

const sitemap = getSitemapPaths();
const indexable = new Set(INDEXABLE_ROUTE_POLICIES.filter((p) => p.indexable).map((p) => p.path));
const noindex = new Set(NOINDEX_ROUTE_POLICIES.map((p) => p.path));

for (const p of sitemap) {
  if (!indexable.has(p)) fail(`sitemap path not in indexable policies: ${p}`);
  if (noindex.has(p)) fail(`sitemap path is noindex: ${p}`);
  if (!p.startsWith("/")) fail(`relative sitemap path invalid: ${p}`);
}
ok(`sitemap paths (${sitemap.length})`);

for (const p of ["/drive", "/pair", "/studio", "/garage", "/settings", "/debug", "/auth"]) {
  if (sitemap.includes(p)) fail(`private route in sitemap: ${p}`);
}
ok("private routes excluded from sitemap");

for (const policy of INDEXABLE_ROUTE_POLICIES) {
  if (!policy.title?.trim()) fail(`missing title: ${policy.path}`);
  if (!policy.description?.trim()) fail(`missing description: ${policy.path}`);
  if (policy.description.length < 40) fail(`description too short: ${policy.path}`);
}
if (!process.exitCode) ok("indexable titles/descriptions");

const ogDefault = path.join(root, "public", "og", "elcamoso-default.png");
if (!fs.existsSync(ogDefault)) fail("missing public/og/elcamoso-default.png");
else ok("default OG image file");

for (const name of ["engine.png", "symphony.png", "worlds.png", "fusion.png", "drive-song.png"]) {
  const p = path.join(root, "public", "og", name);
  if (!fs.existsSync(p)) fail(`missing public/og/${name}`);
}
if (!process.exitCode) ok("variant OG fallback files");

for (const font of ["Outfit-Light.ttf", "Outfit-Regular.ttf"]) {
  const p = path.join(root, "assets", "fonts", font);
  if (!fs.existsSync(p)) fail(`missing assets/fonts/${font}`);
}
if (!process.exitCode) ok("OG Outfit font files");

const robots = fs.readFileSync(path.join(root, "public", "robots.txt"), "utf8");
if (!robots.includes("Sitemap: https://www.elcamoso.com/sitemap.xml")) {
  fail("robots.txt missing Sitemap line");
} else {
  ok("robots.txt sitemap");
}

const xml = buildSitemapXml();
if (!xml.includes(absoluteSeoUrl("/"))) fail("sitemap missing home");
if (xml.includes("lastmod")) fail("sitemap must not invent lastmod");
if (xml.includes("vercel.app")) fail("sitemap must not use preview host");
ok("sitemap xml body");

const dupes = sitemap.filter((p, i) => sitemap.indexOf(p) !== i);
if (dupes.length) fail(`duplicate sitemap paths: ${dupes.join(", ")}`);
else ok("no duplicate sitemap paths");

if (!process.exitCode) console.log("seo:check passed");
