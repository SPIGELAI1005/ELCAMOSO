import { describe, expect, it } from "vitest";
import {
  SEO_CONFIG,
  absoluteSeoUrl,
  buildSitemapXml,
  createSeoHeadFromPath,
  createSeoMetadata,
  driveSongSocialMeta,
  getSeoSiteOrigin,
  getSitemapPaths,
  serializeJsonLd,
} from "@/lib/seo";

describe("SEO platform", () => {
  it("canonical host is www.elcamoso.com", () => {
    expect(getSeoSiteOrigin()).toBe("https://www.elcamoso.com");
    expect(absoluteSeoUrl("/sounds")).toBe("https://www.elcamoso.com/sounds");
    expect(absoluteSeoUrl("/")).toBe("https://www.elcamoso.com/");
  });

  it("indexable pages produce title, description, canonical, og, twitter", () => {
    const head = createSeoHeadFromPath("/symphony");
    const titles = head.meta.filter((m) => m.title);
    expect(titles).toHaveLength(1);
    expect(titles[0]?.title).toContain("Symphony");
    expect(head.meta.some((m) => m.name === "description" && m.content)).toBe(true);
    expect(head.meta.some((m) => m.name === "robots" && m.content === "index, follow")).toBe(true);
    expect(
      head.meta.some((m) => m.property === "og:image" && m.content?.startsWith("https://")),
    ).toBe(true);
    expect(head.meta.some((m) => m.name === "twitter:card")).toBe(true);
    const canonical = head.links.find((l) => l.rel === "canonical");
    expect(canonical?.href).toBe("https://www.elcamoso.com/symphony");
    expect(head.links.filter((l) => l.rel === "canonical")).toHaveLength(1);
  });

  it("noindex routes produce robots noindex", () => {
    const drive = createSeoHeadFromPath("/drive");
    expect(drive.meta.some((m) => m.name === "robots" && m.content?.includes("noindex"))).toBe(
      true,
    );
    const pair = createSeoHeadFromPath("/pair");
    expect(pair.meta.some((m) => m.name === "robots" && m.content === "noindex, nofollow")).toBe(
      true,
    );
  });

  it("sitemap contains indexable and excludes private routes", () => {
    const paths = getSitemapPaths();
    expect(paths).toContain("/");
    expect(paths).toContain("/explore");
    expect(paths).toContain("/sounds");
    expect(paths).not.toContain("/drive");
    expect(paths).not.toContain("/pair");
    expect(paths).not.toContain("/studio");
    expect(paths).not.toContain("/garage");
    expect(paths).not.toContain("/settings");
    expect(paths).not.toContain("/debug");
    const xml = buildSitemapXml(paths);
    expect(xml).toContain("https://www.elcamoso.com/explore");
    expect(xml).not.toContain("/drive");
    expect(xml).not.toMatch(/lastmod/);
  });

  it("structured JSON-LD is valid JSON and uses canonical origin", () => {
    const head = createSeoHeadFromPath("/");
    expect(head.scripts?.length).toBeGreaterThan(0);
    const raw = head.scripts![0]!.children!;
    const parsed = JSON.parse(raw) as { "@graph": Array<{ url?: string }> };
    expect(parsed["@graph"]?.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed)).toContain("https://www.elcamoso.com");
    expect(serializeJsonLd({ a: "<script>" })).toContain("\\u003c");
  });

  it("Drive Song social meta strips GPS/location fields", () => {
    const safe = driveSongSocialMeta({
      title: "Night run",
      description: "latitude 48.1 and home address",
    });
    expect(safe.title).toBe("This drive made a song. | ELCAMOSO");
    expect(safe.description).not.toMatch(/48\.1/);
  });

  it("OG image URLs are absolute", () => {
    const head = createSeoMetadata({
      title: "t",
      description: "d",
      path: "/about",
      image: SEO_CONFIG.defaultImage,
    });
    const img = head.meta.find((m) => m.property === "og:image")?.content;
    expect(img?.startsWith("https://www.elcamoso.com/")).toBe(true);
  });
});
