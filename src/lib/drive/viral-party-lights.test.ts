import { describe, expect, it } from "vitest";
import { policeLightOpacity, setPoliceLightLevel } from "@/lib/drive/police-lights";
import {
  VIRAL_PARTY_CHANT_KMH,
  VIRAL_PARTY_COLORS,
  VIRAL_PARTY_COLOR_NAMES,
  VIRAL_PARTY_CONFETTI_COUNT,
  VIRAL_PARTY_HERO_SIZE,
  VIRAL_PARTY_LIGHT_PROFILE_ID,
  VIRAL_PARTY_ROLL_KMH,
  chantCallOnBar,
  cosineFade,
  cosineWindow,
  fallbackViralPartyClock,
  getViralPartyLightLevel,
  nextViralPartyLightLevel,
  resolveViralPartySection,
  setViralPartyLightLevel,
  viralPartyClockAt,
  viralPartyLightFrame,
  viralPartyLightOpacity,
  type ColorMix,
  type ViralPartyLightFrame,
} from "@/lib/drive/viral-party-lights";
import {
  clearViralEdmTransport,
  publishViralEdmTransport,
  readViralEdmTransport,
} from "@/lib/symphony/viral-edm-read";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  } as Storage;
}

function maxChannel(mix: ColorMix): number {
  return Math.max(mix.pink, mix.violet, mix.cyan, mix.gold);
}

function maxEdge(frame: ViralPartyLightFrame): number {
  return Math.max(
    maxChannel(frame.edges.left),
    maxChannel(frame.edges.right),
    maxChannel(frame.edges.top),
    maxChannel(frame.edges.bottom),
    maxChannel(frame.car),
    frame.climbOpacity,
  );
}

function frameAt(
  section: ViralPartyLightFrame extends never
    ? never
    : Parameters<typeof viralPartyLightFrame>[0]["section"],
  beat: number,
  extra: Partial<Parameters<typeof viralPartyLightFrame>[0]> = {},
) {
  const beatPhase = beat - Math.floor(beat);
  const barInLoop = Math.floor(beat / 4) % 4;
  const barPhase = (beat % 4) / 4;
  return viralPartyLightFrame({
    section,
    peak: 0.6,
    absoluteBeat: beat,
    beatPhase,
    barInLoop,
    barPhase,
    barsIntoPhase: 0,
    buildProgress: 0,
    lastBarOfBuild: false,
    ...extra,
  });
}

describe("Viral Epic Party light levels", () => {
  it("defaults to 60%, caps at 85%, and is off when set off", () => {
    expect(viralPartyLightOpacity("60")).toBe(0.6);
    expect(viralPartyLightOpacity("85")).toBe(0.85);
    expect(viralPartyLightOpacity("off")).toBe(0);
    expect(nextViralPartyLightLevel("60")).toBe("85");
    expect(nextViralPartyLightLevel("85")).toBe("off");
    expect(nextViralPartyLightLevel("off")).toBe("60");
  });

  it("persists on its own localStorage key and does not touch Police Patrol", () => {
    const storage = memoryStorage();
    expect(getViralPartyLightLevel(storage)).toBe("60");
    setViralPartyLightLevel("85", storage);
    expect(getViralPartyLightLevel(storage)).toBe("85");
    setPoliceLightLevel("off", storage);
    expect(getViralPartyLightLevel(storage)).toBe("85");
    expect(policeLightOpacity("off")).toBe(0);
    expect(storage.getItem("elcamoso.viral-party.lights")).toBe("85");
    expect(storage.getItem("elcamoso.police.lights")).toBe("off");
  });

  it("never puts white in the palette", () => {
    const hexes = Object.values(VIRAL_PARTY_COLORS).map((c) => c.toLowerCase());
    expect(hexes).not.toContain("#fff");
    expect(hexes).not.toContain("#ffffff");
    expect(hexes).not.toContain("#fff2f2");
    for (const hex of hexes) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // A near-white would have all channels very high; gold may use R=255.
      expect(Math.min(r, g, b)).toBeLessThan(200);
    }
    expect(VIRAL_PARTY_COLOR_NAMES).toEqual(["pink", "violet", "cyan", "gold"]);
  });
});

describe("Viral Epic Party sections", () => {
  it("maps speed and EDM phase onto idle, roll, chant, build, drop and melodic", () => {
    expect(resolveViralPartySection("bed", 0)).toBe("idle");
    expect(resolveViralPartySection("bed", VIRAL_PARTY_ROLL_KMH - 0.01)).toBe("idle");
    expect(resolveViralPartySection("bed", VIRAL_PARTY_ROLL_KMH)).toBe("roll");
    expect(resolveViralPartySection("bed", 8)).toBe("roll");
    expect(resolveViralPartySection("bed", VIRAL_PARTY_CHANT_KMH)).toBe("chant");
    expect(resolveViralPartySection("bed", 80)).toBe("chant");
    expect(resolveViralPartySection("build", 0)).toBe("build");
    expect(resolveViralPartySection("drop", 0)).toBe("drop");
    expect(resolveViralPartySection("melodic", 0)).toBe("melodic");
    // Arrangement wins over the chant speed range.
    expect(resolveViralPartySection("build", 120)).toBe("build");
    expect(resolveViralPartySection("drop", 120)).toBe("drop");
    expect(resolveViralPartySection("melodic", 120)).toBe("melodic");
  });

  it("calls ElCA on bars 1 and 3 and MOSO on bars 2 and 4", () => {
    expect(chantCallOnBar(0)).toBe("elca");
    expect(chantCallOnBar(1)).toBe("moso");
    expect(chantCallOnBar(2)).toBe("elca");
    expect(chantCallOnBar(3)).toBe("moso");
    expect(chantCallOnBar(4)).toBe("elca");
  });
});

describe("Viral Epic Party cosine fades", () => {
  it("is continuous and never a hard 0/1 step mid-cycle", () => {
    const samples = Array.from({ length: 201 }, (_, i) => cosineFade(i / 200, true));
    expect(samples[0]).toBeCloseTo(1, 10);
    expect(samples[100]).toBeCloseTo(0, 10);
    expect(samples[200]).toBeCloseTo(1, 10);
    for (let i = 1; i < samples.length; i++) {
      expect(Math.abs(samples[i]! - samples[i - 1]!)).toBeLessThan(0.04);
    }
    expect(cosineWindow(-0.1, 2)).toBe(0);
    expect(cosineWindow(0, 2)).toBe(0);
    expect(cosineWindow(1, 2)).toBeCloseTo(1, 10);
    expect(cosineWindow(2, 2)).toBe(0);
  });
});

describe("Viral Epic Party frame logic", () => {
  it("returns nothing when the peak is off, and never exceeds 0.85", () => {
    const off = frameAt("drop", 0, { peak: 0 });
    expect(maxEdge(off)).toBe(0);
    expect(off.confetti).toBe(false);
    const hot = frameAt("drop", 0, { peak: 0.85 });
    expect(maxEdge(hot)).toBeGreaterThan(0.4);
    expect(maxEdge(hot)).toBeLessThanOrEqual(0.85);
    const clipped = frameAt("drop", 0, { peak: 2 });
    expect(maxEdge(clipped)).toBeLessThanOrEqual(0.85);
  });

  it("idles as a slow violet breath on every edge", () => {
    const a = frameAt("idle", 0);
    const b = frameAt("idle", 4);
    expect(a.edges.left.violet).toBeGreaterThan(0.2);
    expect(a.edges.right.violet).toBeGreaterThan(0.2);
    expect(a.edges.left.pink).toBe(0);
    expect(a.edges.left.cyan).toBe(0);
    expect(a.edges.left.gold).toBe(0);
    // Mid-breath is dimmer than the peak.
    expect(b.edges.left.violet).toBeLessThan(a.edges.left.violet);
  });

  it("swaps pink and violet left/right on each beat during the accordion roll", () => {
    const even = frameAt("roll", 0);
    const odd = frameAt("roll", 1);
    expect(even.edges.left.pink).toBeGreaterThan(even.edges.left.violet);
    expect(even.edges.right.violet).toBeGreaterThan(even.edges.right.pink);
    expect(odd.edges.left.violet).toBeGreaterThan(odd.edges.left.pink);
    expect(odd.edges.right.pink).toBeGreaterThan(odd.edges.right.violet);
    // Mid-beat is a blend, not a hard cut.
    const mid = frameAt("roll", 0.5);
    expect(Math.abs(mid.edges.left.pink - mid.edges.left.violet)).toBeLessThan(0.05);
  });

  it("flashes pink on the left for ElCA and gold on the right for MOSO", () => {
    const elca = frameAt("chant", 1); // midpoint of the 2-beat ElCA window, bar 0
    const moso = frameAt("chant", 5); // midpoint of the MOSO window, bar 1
    expect(elca.edges.left.pink).toBeGreaterThan(0.4);
    expect(elca.edges.right.gold).toBe(0);
    expect(moso.edges.right.gold).toBeGreaterThan(0.4);
    expect(moso.edges.left.pink).toBe(0);
    // Quiet in the second half of the bar.
    const rest = frameAt("chant", 2.2);
    expect(maxEdge(rest)).toBeLessThan(0.05);
  });

  it("climbs and brightens through the build, then goes near-dark on the last bar", () => {
    const early = frameAt("build", 0, { barsIntoPhase: 0.2, buildProgress: 0.05 });
    const late = frameAt("build", 20, { barsIntoPhase: 5, buildProgress: 5 / 8 });
    const last = frameAt("build", 28, {
      barsIntoPhase: 7.2,
      buildProgress: 0.9,
      lastBarOfBuild: true,
      barPhase: 0.2,
    });
    const gap = frameAt("build", 31, {
      barsIntoPhase: 7.8,
      buildProgress: 1,
      lastBarOfBuild: true,
      barPhase: 0.8,
    });
    expect(early.climb).toBeLessThan(late.climb);
    expect(late.climb).toBeCloseTo(5 / 8, 5);
    expect(late.climbOpacity).toBeGreaterThan(early.climbOpacity);
    expect(maxEdge(last)).toBeLessThan(0.08);
    expect(maxEdge(gap)).toBe(0);
    expect(gap.climbOpacity).toBe(0);
  });

  it("bursts all four edges on the drop and raises gold confetti", () => {
    const drop = frameAt("drop", 8);
    expect(drop.confetti).toBe(true);
    expect(VIRAL_PARTY_CONFETTI_COUNT).toBe(12);
    expect(maxChannel(drop.edges.left)).toBeGreaterThan(0.3);
    expect(maxChannel(drop.edges.right)).toBeGreaterThan(0.3);
    expect(maxChannel(drop.edges.top)).toBeGreaterThan(0.3);
    expect(maxChannel(drop.edges.bottom)).toBeGreaterThan(0.3);
  });

  it("washes slow wide pink, cyan and gold waves in the melodic section", () => {
    const a = frameAt("melodic", 0);
    const cyanPeak = frameAt("melodic", 32 / 3);
    expect(a.edges.left.pink).toBeGreaterThan(0.4);
    expect(a.edges.right.cyan).toBeGreaterThan(0.1);
    expect(a.edges.top.gold).toBeGreaterThan(0.1);
    expect(a.edges.left.violet).toBe(0);
    // Cyan is phase-offset by a third of the 16-beat cycle.
    expect(cyanPeak.edges.right.cyan).toBeGreaterThan(a.edges.right.cyan);
    expect(cyanPeak.edges.right.cyan).toBeGreaterThan(0.4);
    expect(a.confetti).toBe(false);
  });
});

describe("Viral Epic Party transport read", () => {
  it("is a cheap in-place snapshot the animation frame can read without cloning", () => {
    clearViralEdmTransport();
    expect(readViralEdmTransport().ready).toBe(false);
    const published = {
      packId: VIRAL_PARTY_LIGHT_PROFILE_ID,
      audioTime: 12,
      origin: 2,
      perfNow: 5000,
      bpm: 120,
      beatsPerBar: 4,
      barsPerLoop: 4,
      beatDuration: 0.5,
      barDuration: 2,
      beatPhase: 0.25,
      bar: 1,
      beat: 1,
      absoluteBeat: 5.25,
      phase: "drop" as const,
      barsIntoPhase: 1.5,
      buildProgress: 0,
      lastBarOfBuild: false,
      kmh: 130,
    };
    publishViralEdmTransport(published);
    const a = readViralEdmTransport();
    const b = readViralEdmTransport();
    expect(a).toBe(b);
    expect(a.ready).toBe(true);
    expect(a.phase).toBe("drop");
    const clock = viralPartyClockAt(5000, 0);
    expect(clock.fromEngine).toBe(true);
    expect(clock.section).toBe("drop");
    expect(clock.kmh).toBe(130);
    // 10 s after origin at 120 BPM is 20 beats; rAF does not use the cached absoluteBeat field.
    expect(clock.absoluteBeat).toBeCloseTo(20, 5);
    const later = viralPartyClockAt(5250, 0);
    expect(later.absoluteBeat).toBeCloseTo(20.5, 5);
    clearViralEdmTransport("other-pack");
    expect(readViralEdmTransport().ready).toBe(true);
    clearViralEdmTransport(VIRAL_PARTY_LIGHT_PROFILE_ID);
    expect(readViralEdmTransport().ready).toBe(false);
  });

  it("falls back to a 120 BPM bar clock when the engine is silent", () => {
    clearViralEdmTransport();
    const clock = fallbackViralPartyClock(4000, 7);
    expect(clock.fromEngine).toBe(false);
    expect(clock.bpm).toBe(120);
    expect(clock.section).toBe("roll");
    // 4.0 s at 120 BPM is 8 beats = start of bar 2 (0-indexed bar 2).
    expect(clock.absoluteBeat).toBeCloseTo(8, 5);
    expect(clock.barInLoop).toBe(2);
    expect(clock.barPhase).toBeCloseTo(0, 5);
  });
});

describe("Viral Epic Party hero coordinates", () => {
  it("places glows inside the 1672x941 still", () => {
    expect(VIRAL_PARTY_HERO_SIZE).toEqual({ w: 1672, h: 941 });
  });
});
