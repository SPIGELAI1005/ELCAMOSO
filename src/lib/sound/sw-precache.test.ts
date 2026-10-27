import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMBUSTION_WORKLET_VERSION } from "@/lib/sound/realism/v2/combustion-excitation";

const root = process.cwd();
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("service worker audio precache", () => {
  it("lists every file under /sample-packs/recorded", () => {
    const base = join(root, "public");
    const files = walk(join(base, "sample-packs/recorded"))
      .map((f) => f.slice(base.length))
      .sort();
    for (const f of files) expect(sw, f).toContain(`"${f}"`);
  });

  it("uses the current combustion worklet version", () => {
    expect(sw).toContain(`"?v=${COMBUSTION_WORKLET_VERSION}"`);
  });

  it("serves sample packs and the worklet with a cache lifetime", () => {
    const cfg = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    for (const source of ["/sample-packs/recorded/(.*)", "/audio/(.*)"]) {
      const rule = cfg.headers.find((h) => h.source === source);
      expect(rule, source).toBeDefined();
      expect(rule!.headers.find((h) => h.key === "Cache-Control")?.value).toMatch(/max-age=\d{5,}/);
    }
  });
});
