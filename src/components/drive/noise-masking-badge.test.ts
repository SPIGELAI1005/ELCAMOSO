import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DRIVE_PILL_BADGE_CLASS,
  DRIVE_PILL_BADGE_OFF_CLASS,
  DRIVE_PILL_BADGE_ON_CLASS,
  DRIVE_PILL_BADGE_WIDE_CLASS,
} from "@/components/drive/DrivePillBadge";

const dir = dirname(fileURLToPath(import.meta.url));
const toggleSrc = readFileSync(join(dir, "../NoiseMaskingToggle.tsx"), "utf8");
const cockpitSrc = readFileSync(join(dir, "DriveCockpit.tsx"), "utf8");

describe("Drive pill badge chrome", () => {
  it("matches the original messages counter position, size, type and shape", () => {
    expect(DRIVE_PILL_BADGE_CLASS).toContain("absolute -top-1 -right-1");
    expect(DRIVE_PILL_BADGE_CLASS).toContain("flex h-5 min-w-5 items-center justify-center");
    expect(DRIVE_PILL_BADGE_CLASS).toContain("rounded-full");
    expect(DRIVE_PILL_BADGE_CLASS).toContain("px-1");
    expect(DRIVE_PILL_BADGE_CLASS).toContain("text-[10px] font-semibold");
    expect(DRIVE_PILL_BADGE_ON_CLASS).toBe("bg-[#e53935] text-white");
  });

  it("gives the off state no fill and a pill-outline border", () => {
    expect(DRIVE_PILL_BADGE_OFF_CLASS).toContain("bg-transparent");
    expect(DRIVE_PILL_BADGE_OFF_CLASS).toContain("border-white/15");
    expect(DRIVE_PILL_BADGE_OFF_CLASS).not.toContain("bg-[#e53935]");
  });

  it("widens slightly for three-letter labels while staying a pill", () => {
    expect(DRIVE_PILL_BADGE_WIDE_CLASS).toContain("px-1.5");
    expect(DRIVE_PILL_BADGE_WIDE_CLASS).toContain("min-w-[1.35rem]");
  });
});

describe("Road Noise Masking Drive toggle", () => {
  it("keeps ON/OFF out of the left caption", () => {
    const start = toggleSrc.indexOf('data-testid="road-noise-masking-caption"');
    const end = toggleSrc.indexOf('data-testid="road-noise-masking-pill"');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const caption = toggleSrc.slice(start, end);
    expect(caption).toContain("Road Noise");
    expect(caption).toContain("Masking");
    expect(caption).not.toContain("{stateLabel}");
    expect(caption).not.toMatch(/>\s*ON\s*</);
    expect(caption).not.toMatch(/>\s*OFF\s*</);
    expect(caption).not.toContain("masterOn");
  });

  it("shows the status in a shared messages-style corner badge", () => {
    expect(toggleSrc).toContain('testId="road-noise-masking-badge"');
    expect(toggleSrc).toContain("DrivePillBadge");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_ON_CLASS");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_OFF_CLASS");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_WIDE_CLASS");
    expect(toggleSrc).toContain('{masterOn ? "ON" : "OFF"}');
  });

  it("announces the on/off state in the aria-label", () => {
    expect(toggleSrc).toContain('`${gate.label}, ${masterOn ? "on" : "off"}`');
  });

  it("keeps the lock on the signed-out pill without covering the status badge", () => {
    expect(toggleSrc).toContain('data-testid="road-noise-masking-lock"');
    expect(toggleSrc).toContain("-right-1 -bottom-1");
    expect(toggleSrc).not.toMatch(/road-noise-masking-lock[\s\S]*?-top-1 -right-1/);
  });
});

describe("messages pill reuses the same badge", () => {
  it("renders the inbox counter with DrivePillBadge", () => {
    expect(cockpitSrc).toContain("DrivePillBadge");
    expect(cockpitSrc).toContain('testId="inbox-badge"');
    expect(cockpitSrc).toContain("DRIVE_PILL_BADGE_ON_CLASS");
  });
});
