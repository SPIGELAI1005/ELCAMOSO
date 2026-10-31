import { describe, expect, it } from "vitest";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { FREE_SOUND_PROFILE_SET } from "@/lib/sound/profile-access-config";
import { defaultGenreForProfile, hasSignatureGenre } from "@/lib/symphony/adaptive/genre-store";
import { GENRES } from "@/lib/symphony/adaptive/genres";
import { SPOOKY_KINDS, isSpookyKind } from "@/lib/sound/dsp/spooky";

describe("Dracula Carriage", () => {
  const p = SOUND_PROFILES.find((x) => x.id === "dracula-carriage");

  it("exists, builds on the carriage voice and carries the spooky one-shots", () => {
    expect(p?.name).toBe("Dracula Carriage");
    expect(p?.voice.rhythm?.kind).toBe("gallop");
    const kinds = p?.voice.signals?.map((s) => s.kind) ?? [];
    for (const k of ["cackle", "eerie", "scream", "gust", "howl"]) expect(kinds).toContain(k);
    expect(p?.voice.textures?.some((t) => t.kind === "wind")).toBe(true);
  });

  it("keeps screams rare", () => {
    const scream = p?.voice.signals?.find((s) => s.kind === "scream");
    expect(scream!.everySeconds).toBeGreaterThanOrEqual(40);
  });

  it("is a free profile", () => {
    expect(FREE_SOUND_PROFILE_SET.map((s) => s.id)).toContain("dracula-carriage");
  });

  it("plays the gothic genre underneath", () => {
    expect(hasSignatureGenre("dracula-carriage")).toBe(true);
    expect(defaultGenreForProfile("dracula-carriage")).toBe("gothic");
    const g = GENRES.gothic;
    expect(g.progression[0]!.tones).toEqual([0, 3, 7]); // minor tonic
  });

  it("gothic pattern adds organ, choir and timpani as intensity rises", () => {
    const g = GENRES.gothic;
    const insts = new Set<string>();
    for (let step = 0; step < 16; step += 1) {
      const notes = g.pattern({
        step,
        bar: 0,
        intensity: 0.9,
        mode: "cruise",
        root: 50,
        chord: [50, 53, 57],
        barDur: 3,
        stepDur: 0.19,
        variation: 0,
        rand: () => 0.5,
      } as never);
      notes.forEach((n) => insts.add(n.inst));
    }
    for (const i of ["organ", "choir", "timpani", "cello", "strings"]) expect(insts).toContain(i);
  });

  it("spooky kinds are recognised", () => {
    for (const k of SPOOKY_KINDS) expect(isSpookyKind(k)).toBe(true);
    expect(isSpookyKind("horn")).toBe(false);
  });
});
