import { describe, expect, it } from "vitest";
import { createConductor, tempoForSpeed, type ConductorInput } from "./conductor";
import { createTimeline } from "./timeline";
import { GENRES, GENRE_IDS } from "./genres";
import { pickSample, MUSIC_BANK } from "./sample-bank";
import { resolveGenre } from "./genre-store";

const cfg = { bpmMin: 80, bpmMax: 140 };
function drive(c: ReturnType<typeof createConductor>, secs: number, inp: Partial<ConductorInput>) {
  const dt = 1 / 30;
  let s = c.snapshot();
  for (let t = 0; t < secs; t += dt) {
    s = c.update({ speed: 0, acceleration: 0, throttle: 0, regen: 0, gear: 0, dt, ...inp });
  }
  return s;
}

describe("adaptive conductor", () => {
  it("maps speed to tempo between the genre range", () => {
    expect(tempoForSpeed(0, cfg)).toBe(80);
    expect(tempoForSpeed(130, cfg)).toBeCloseTo(140);
    const c = createConductor(cfg);
    const s = drive(c, 40, { speed: 120 / 3.6 });
    expect(s.bpm).toBeGreaterThan(130);
  });

  it("changes tempo smoothly (rate limited)", () => {
    const c = createConductor(cfg);
    const s = drive(c, 1, { speed: 130 / 3.6 });
    expect(s.bpm).toBeLessThan(86);
  });

  it("surges on hard acceleration and builds intensity", () => {
    const c = createConductor(cfg);
    drive(c, 10, { speed: 50 / 3.6 });
    const before = c.snapshot().intensity;
    const s = drive(c, 2, { speed: 55 / 3.6, acceleration: 3, throttle: 0.9 });
    expect(s.mode).toBe("surge");
    expect(s.intensity).toBeGreaterThan(before + 0.15);
    expect(c.drainAccents()).toContain("surge");
  });

  it("softens and filters on hard braking", () => {
    const c = createConductor(cfg);
    drive(c, 15, { speed: 90 / 3.6 });
    const before = c.snapshot();
    const s = drive(c, 1.5, { speed: 70 / 3.6, acceleration: -4, regen: 0.8 });
    expect(s.mode).toBe("brake");
    expect(s.brightness).toBeLessThan(before.brightness - 0.2);
    expect(s.intensity).toBeLessThan(before.intensity);
  });

  it("settles into cruise when speed is held", () => {
    const c = createConductor(cfg);
    const s = drive(c, 12, { speed: 100 / 3.6 });
    expect(s.mode).toBe("cruise");
  });

  it("emits accents for real gear changes", () => {
    const c = createConductor(cfg);
    drive(c, 1, { speed: 10, gear: 2 });
    c.drainAccents();
    drive(c, 0.1, { speed: 10, gear: 3 });
    drive(c, 0.1, { speed: 10, gear: 2 });
    expect(c.drainAccents()).toEqual(["upshift", "downshift"]);
  });

  it("uses musical gears on gearless profiles", () => {
    const c = createConductor(cfg);
    drive(c, 10, { speed: 50 / 3.6 });
    expect(c.drainAccents().filter((a) => a === "upshift").length).toBeGreaterThanOrEqual(2);
  });

  it("raises the key while climbing and ignores missing altitude", () => {
    const c = createConductor(cfg);
    const dt = 1 / 10;
    let alt = 100;
    let s = c.snapshot();
    for (let t = 0; t < 40; t += dt) {
      alt += (60 / 3.6) * dt * 0.06; // 6 % grade
      s = c.update({ speed: 60 / 3.6, acceleration: 0, throttle: 0.3, regen: 0, gear: 0, dt, altitude: alt, altitudeAccuracy: 5 });
    }
    expect(s.elevationTrend).toBe("climb");
    expect(s.transpose).toBe(2);
    const n = createConductor(cfg);
    const s2 = drive(n, 30, { speed: 60 / 3.6, altitude: null });
    expect(s2.elevationTrend).toBe("unknown");
    expect(s2.transpose).toBe(0);
  });
});

describe("adaptive timeline", () => {
  it("is gapless and on the grid while tempo changes", () => {
    const c = createConductor(cfg);
    const tl = createTimeline("classic", 0, 3);
    let t = 0;
    const events = [];
    for (let i = 0; i < 600; i++) {
      t += 1 / 30;
      const s = c.update({ speed: (i / 600) * 35, acceleration: 1, throttle: 0.5, regen: 0, gear: 0, dt: 1 / 30 });
      events.push(...tl.scheduleUntil(t + 0.35, s));
    }
    const times = events.map((e) => e.time);
    expect(times.length).toBeGreaterThan(100);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThan(-1);
  });

  it("every genre note maps to a rendered sample", () => {
    for (const id of GENRE_IDS) {
      const g = GENRES[id];
      for (const mode of ["stopped", "flow", "cruise", "surge", "brake"] as const) {
        for (const intensity of [0.1, 0.5, 0.9]) {
          for (let step = 0; step < 16; step++) {
            const notes = g.pattern({ step, bar: step, chord: [g.key, g.key + 4, g.key + 7], root: g.key, intensity, mode, variation: step, stepDur: 0.12, barDur: 1.9, rand: Math.random });
            for (const n of notes) {
              expect(MUSIC_BANK[n.inst], `${id} ${n.inst}`).toBeDefined();
              expect(pickSample(n.inst, n.midi), `${id} ${n.inst} ${n.midi}`).not.toBeNull();
            }
          }
        }
      }
      for (const [inst, note] of [g.accents.crash, ...g.accents.fill[1].map((n) => [g.accents.fill[0], n] as const), ...g.accents.low[1].map((n) => [g.accents.low[0], n] as const)]) {
        expect(pickSample(inst as string, note as number)).not.toBeNull();
      }
    }
  });

  it("brake mode keeps drums out", () => {
    const g = GENRES.house;
    for (let step = 0; step < 16; step++) {
      const notes = g.pattern({ step, bar: 0, chord: [45, 48, 52], root: 45, intensity: 0.12, mode: "brake", variation: 0, stepDur: 0.12, barDur: 1.9, rand: Math.random });
      expect(notes.filter((n) => n.inst === "drums_elec" && n.midi !== 36)).toHaveLength(0);
    }
  });

  it("resolves profile default genres", () => {
    expect(resolveGenre("symphony-motion-orchestra", "auto")).toBe("waltz");
    expect(resolveGenre("symphony-neon-run", "auto")).toBe("house");
    expect(resolveGenre("symphony-neon-run", "auto")).toBe("house");
    expect(resolveGenre("symphony-cinematic-rock", "auto")).toBe("rock");
    expect(resolveGenre("symphony-motion-orchestra", "rock")).toBe("rock");
    // signature profiles ignore the global picker
    expect(resolveGenre("deep-bass-pulse", "classic")).toBe("electro");
    expect(resolveGenre("fusion-road-anthem", "house")).toBe("anthem");
    expect(resolveGenre("fusion-midnight-boost", "waltz")).toBe("darkrave");
    expect(resolveGenre("fusion-midnight-boost", "auto")).toBe("darkrave");
  });
});

describe("all genres", () => {
  it("only use instruments in the sample bank and mix, and react to intensity", async () => {
    const { GENRES, GENRE_IDS } = await import("./genres");
    const { MUSIC_BANK } = await import("./sample-bank-data");
    expect(GENRE_IDS).toEqual(expect.arrayContaining(["pop", "metal", "hiphop", "country"]));
    for (const id of GENRE_IDS) {
      const g = GENRES[id];
      const count = (I: number, mode: "cruise" | "brake") => {
        let n = 0;
        for (let bar = 0; bar < 4; bar++)
          for (let step = 0; step < 16; step++) {
            const p = g.progression[bar % 4]!;
            const root = g.key + p.deg;
            const notes = g.pattern({ step, bar, chord: p.tones.map((t) => root + t), root, intensity: I, mode, variation: bar, stepDur: 0.12, barDur: 1.9, rand: Math.random });
            for (const x of notes) {
              expect(MUSIC_BANK[x.inst], `${id}:${x.inst}`).toBeDefined();
              expect(g.mix[x.inst], `${id} mix ${x.inst}`).toBeDefined();
            }
            n += notes.length;
          }
        return n;
      };
      expect(count(0.9, "cruise")).toBeGreaterThan(count(0.15, "brake"));
      for (const inst of [g.accents.crash[0], g.accents.fill[0], g.accents.low[0]]) expect(MUSIC_BANK[inst]).toBeDefined();
    }
  });
});

describe("waltz meter", () => {
  it("runs 12 sixteenths per bar (3/4) with oom on 1 and pah-pah on 2 and 3", async () => {
    const { createTimeline } = await import("./timeline");
    const tl = createTimeline("waltz", 0, 1);
    const st = { bpm: 120, intensity: 0.6, brightness: 0.6, mode: "cruise", transpose: 0 } as never;
    const ev = tl.scheduleUntil(12 * (60 / 120 / 4) * 2 - 0.001, st);
    expect(tl.bar).toBe(1);
    const bass = ev.filter((e) => e.inst === "contrabass").map((e) => Math.round(e.time / (60 / 120 / 4)));
    expect(bass).toEqual([0, 12]);
    expect(ev.some((e) => e.inst === "viola")).toBe(true);
  });
});

describe("orchestral options", () => {
  it("keeps the 4/4 Cinematic Orchestra selectable next to the Vienna Waltz", async () => {
    const { GENRES, GENRE_IDS } = await import("./genres");
    const { resolveGenre } = await import("./genre-store");
    expect(GENRE_IDS).toEqual(expect.arrayContaining(["classic", "waltz"]));
    expect(GENRES.classic.name).toBe("Cinematic Orchestra");
    expect(GENRES.classic.stepsPerBar ?? 16).toBe(16);
    expect(GENRES.waltz.stepsPerBar).toBe(12);
    expect(resolveGenre("symphony-motion-orchestra", "auto")).toBe("waltz");
    expect(resolveGenre("symphony-motion-orchestra", "classic")).toBe("classic");
  });
});

describe("genre choice migration", () => {
  it("drops a stale saved genre once", async () => {
    const { migrateGenreChoice } = await import("./genre-store");
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage;
    m.set("elcamoso.music.genre", "classic");
    migrateGenreChoice(st);
    expect(m.get("elcamoso.music.genre")).toBeUndefined();
    m.set("elcamoso.music.genre", "rock");
    migrateGenreChoice(st);
    expect(m.get("elcamoso.music.genre")).toBe("rock");
  });
});
