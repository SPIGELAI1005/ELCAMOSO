import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const toggleSrc = readFileSync(join(dir, "ViralPartyLightToggle.tsx"), "utf8");
const showSrc = readFileSync(join(dir, "ViralPartyLightShow.tsx"), "utf8");
const cockpitSrc = readFileSync(join(dir, "DriveCockpit.tsx"), "utf8");
const policeSrc = readFileSync(join(dir, "PoliceLightShow.tsx"), "utf8");

describe("Viral Epic Party Light Show toggle", () => {
  it("uses a two-line Light / Show caption without ON/OFF in the label", () => {
    const start = toggleSrc.indexOf('data-testid="viral-party-light-caption"');
    const end = toggleSrc.indexOf('data-testid="viral-party-light-pill"');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const caption = toggleSrc.slice(start, end);
    expect(caption).toContain("Light");
    expect(caption).toContain("Show");
    expect(caption).not.toMatch(/>\s*ON\s*</);
    expect(caption).not.toMatch(/>\s*OFF\s*</);
  });

  it("shows the status in a shared messages-style corner badge", () => {
    expect(toggleSrc).toContain('testId="viral-party-light-badge"');
    expect(toggleSrc).toContain("DrivePillBadge");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_ON_CLASS");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_OFF_CLASS");
    expect(toggleSrc).toContain("DRIVE_PILL_BADGE_WIDE_CLASS");
    expect(toggleSrc).toContain('{visualOn ? "ON" : "OFF"}');
  });

  it("announces Light Show, on/off in the aria-label", () => {
    expect(toggleSrc).toContain('`Light Show, ${visualOn ? "on" : "off"}`');
  });

  it("shows the toggle as off and disabled under reduced motion, with an aria hint", () => {
    expect(toggleSrc).toContain("disabled={reducedMotion}");
    expect(toggleSrc).toContain("const visualOn = !reducedMotion && storedOn");
    expect(toggleSrc).toContain(
      '"Light Show, off. The light show is disabled when reduced motion is on."',
    );
  });

  it("sits under Road Noise Masking in the Drive header, only for Viral Epic Party", () => {
    expect(cockpitSrc).toContain("ViralPartyLightToggle");
    const rnm = cockpitSrc.indexOf("<NoiseMaskingDriveToggle");
    const lights = cockpitSrc.indexOf("<ViralPartyLightToggle");
    expect(rnm).toBeGreaterThanOrEqual(0);
    expect(lights).toBeGreaterThan(rnm);
    const gate = cockpitSrc.slice(rnm, lights);
    expect(gate).toContain("VIRAL_PARTY_LIGHT_PROFILE_ID");
  });

  it("removes the old bottom-left 60/85/off cycle from this profile", () => {
    expect(showSrc).not.toContain("Lights 60%");
    expect(showSrc).not.toContain("Lights 85%");
    expect(showSrc).not.toContain("Lights off");
    expect(showSrc).not.toContain("bottom-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(showSrc).not.toContain("viral-party-light-toggle");
  });

  it("leaves the Police Patrol lights button unchanged", () => {
    expect(policeSrc).toContain('data-testid="police-light-toggle"');
    expect(policeSrc).toContain("Lights 60%");
    expect(policeSrc).toContain("Lights 85%");
    expect(policeSrc).toContain("Lights off");
  });
});
