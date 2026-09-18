import { describe, expect, it } from "vitest";
import {
  applySymphonyStudioToGains,
  ensureViableInstruments,
  studioDemoStateAt,
  studioPromptToParams,
  DEFAULT_SYMPHONY_PARAMS,
  decodeExperiencePresetShare,
  encodeExperiencePresetShare,
} from "@/lib/studio";

describe("Studio Symphony params", () => {
  it("never allows full instrument silence", () => {
    const instruments = ensureViableInstruments({
      atmosphere: false,
      drums: false,
      bass: false,
      guitar: false,
      strings: false,
      lead: false,
    });
    expect(instruments.atmosphere).toBe(true);
  });

  it("keeps a base when all stems muted via focus", () => {
    const gains = applySymphonyStudioToGains(
      { atmosphere: 0.5, bass: 0.5, drumsHigh: 0.5, lead: 0.5 },
      {
        ...DEFAULT_SYMPHONY_PARAMS,
        instruments: {
          atmosphere: false,
          drums: false,
          bass: false,
          guitar: false,
          strings: false,
          lead: false,
        },
      },
      "cruise",
    );
    const sum = Object.values(gains).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBeGreaterThan(0.05);
  });

  it("demo traces are deterministic for A/B", () => {
    const a = studioDemoStateAt("city", 12.5);
    const b = studioDemoStateAt("city", 12.5);
    expect(a.speed).toBe(b.speed);
    expect(a.throttle).toBe(b.throttle);
  });

  it("prompt parse configures symphony without telemetry", () => {
    const r = studioPromptToParams(
      "cinematic rock that stays calm during cruising but explodes under strong acceleration",
    );
    expect(r.mode).toBe("symphony");
    expect(r.symphonyParams?.climaxSensitivity).toBeGreaterThan(0.7);
    expect(r.description).not.toMatch(/generat/i);
  });

  it("round-trips a versioned Symphony share and rejects malformed payloads", () => {
    const encoded = encodeExperiencePresetShare({
      id: "local-only",
      kind: "symphony",
      name: "Night Motion",
      createdAt: 1,
      symphonyPackId: "symphony-cinematic-rock",
      symphonyParams: DEFAULT_SYMPHONY_PARAMS,
    });
    const decoded = decodeExperiencePresetShare(encoded);
    expect(decoded).toMatchObject({
      kind: "symphony",
      name: "Night Motion",
      symphonyPackId: "symphony-cinematic-rock",
    });
    expect(decoded?.id).not.toBe("local-only");
    expect(decodeExperiencePresetShare("not-base64-json")).toBeNull();
  });
});
