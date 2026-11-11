import { describe, expect, it } from "vitest";
import { GENRES, PROFILE_ONLY_GENRE_IDS } from "@/lib/symphony/adaptive/genres";
import { hasSignatureGenre, isAutoDj, resolveGenre } from "@/lib/symphony/adaptive/genre-store";
import { hasInstrument, pickSample } from "@/lib/symphony/adaptive/sample-bank";
import { autoDjPool } from "@/lib/symphony/adaptive/auto-dj";
import type { StepContext } from "@/lib/symphony/adaptive/genres";

describe("viralmix signature genre", () => {
  const g = GENRES.viralmix;
  const ctx = (
    step: number,
    intensity: number,
    mode: StepContext["mode"] = "cruise",
  ): StepContext => ({
    step,
    bar: 1,
    chord: [49, 52, 56],
    root: 49,
    intensity,
    mode,
    variation: 0,
    stepDur: 60 / 108 / 4,
    barDur: (60 / 108) * 4,
    rand: Math.random,
  });
  const insts = (I: number, mode: StepContext["mode"] = "cruise") =>
    new Set(
      Array.from({ length: 4 }, (_, bar) =>
        Array.from({ length: 16 }, (_, s) => g.pattern({ ...ctx(s, I, mode), bar })),
      )
        .flat(2)
        .map((n) => `${n.inst}:${n.midi}`),
    );

  it("is a fixed 108 bpm C# minor signature genre bound to Viral Epic Party", () => {
    expect(g.name).toBe("Viral Epic Party");
    expect(g.id).toBe("viralmix");
    expect(g.fixedBpm).toBe(108);
    expect(g.key).toBe(49);
    expect(g.lockArrangement).toBe(true);
    expect(PROFILE_ONLY_GENRE_IDS).toContain("viralmix");
    expect(resolveGenre("symphony-viral-mix", "metal")).toBe("viralmix");
    expect(resolveGenre("symphony-viral-mix", "auto")).toBe("viralmix");
    expect(resolveGenre("symphony-viral-mix", "classic")).toBe("viralmix");
    expect(hasSignatureGenre("symphony-viral-mix")).toBe(true);
    expect(isAutoDj("symphony-viral-mix", "auto")).toBe(false);
    expect(autoDjPool()).not.toContain("viralmix");
  });

  it("does not let the shared picker or Auto DJ override other signatures", () => {
    expect(resolveGenre("symphony-latino-fiesta", "auto")).toBe("latino");
    expect(isAutoDj("symphony-neon-run", "auto")).toBe(true);
  });

  it("adds layers as speed / intensity rises", () => {
    const idle = [...insts(0.05, "stopped")].join(" ");
    expect(idle).toContain("pad");
    expect(idle).not.toContain("drums_elec:36");
    expect(idle).not.toContain("lead:");

    const roll = [...insts(0.25, "flow")].join(" ");
    expect(roll).toContain("drums_elec:36");
    expect(roll).toContain("synthbass");
    expect(roll).not.toContain("drums_elec:39");
    expect(roll).not.toContain("lead:");

    const cruise = [...insts(0.5, "cruise")].join(" ");
    expect(cruise).toContain("drums_elec:39");
    expect(cruise).toContain("organ");
    expect(cruise).toContain("lead:");
    expect(cruise).toContain("vox_choir");
    expect(cruise).not.toContain("vox_hey");

    const high = [...insts(0.85, "cruise")].join(" ");
    expect(high).toContain("lead:");
    expect(high).toContain("drums_elec:42");
    expect(high).toContain("drums_elec:46");
    expect(high).toContain("vox_hey");
    expect(high).toContain("vox_choir_ooh");
  });

  it("follows the i-i-i-III loop and only plays playable instruments", () => {
    expect(g.progression.map((p) => p.deg)).toEqual([0, 0, 0, 3]);
    for (const I of [0.05, 0.25, 0.5, 0.7, 0.95]) {
      for (const mode of ["stopped", "flow", "cruise", "surge", "brake"] as const) {
        for (const s of insts(I, mode)) {
          const [inst, midi] = s.split(":");
          expect(hasInstrument(inst!), s).toBe(true);
          expect(g.mix[inst!], `mix ${s}`).toBeDefined();
          expect(pickSample(inst!, Number(midi)), s).not.toBeNull();
        }
      }
    }
  });

  it("keeps hats and claps out while braking", () => {
    for (let step = 0; step < 16; step++) {
      const notes = g.pattern(ctx(step, 0.9, "brake"));
      expect(notes.filter((n) => n.inst === "drums_elec")).toHaveLength(0);
    }
  });
});
