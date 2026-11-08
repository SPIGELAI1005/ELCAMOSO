import { describe, expect, it } from "vitest";
import { createConductor, tempoForSpeed, type ConductorInput, type ConductorState } from "./conductor";
import { createTimeline } from "./timeline";
import { GENRES, GENRE_IDS } from "./genres";
import { autoDjPool } from "./auto-dj";
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
    expect(resolveGenre("symphony-cinematic-rock", "auto")).toBe("cinrock");
    expect(resolveGenre("symphony-cinematic-rock", "rock")).toBe("cinrock");
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

describe("road anthem real band", () => {
  it("uses acoustic kit, bass, re-amped guitars and organ, with no synth pads and no stacked power chords", () => {
    const g = GENRES.anthem;
    const used = new Set<string>();
    for (const I of [0.2, 0.45, 0.7, 0.95])
      for (let bar = 0; bar < 8; bar++)
        for (let step = 0; step < 16; step++) {
          const p = g.progression[bar % 4]!;
          const root = g.key + p.deg;
          const notes = g.pattern({ step, bar, chord: p.tones.map((t) => root + t), root, intensity: I, mode: "cruise", variation: bar, stepDur: 0.136, barDur: 2.18, rand: () => 0.5 });
          for (const n of notes) used.add(n.inst);
          // one power-chord sample per side per hit (the sprite already holds root-5th-octave)
          expect(notes.filter((n) => n.inst === "rockgtr").length).toBeLessThanOrEqual(2);
        }
    for (const inst of ["drums_room", "ebass", "rockgtr", "rocklead", "cleangtr", "rockorgan", "piano", "trumpet"]) expect(used.has(inst), inst).toBe(true);
    for (const inst of ["pad", "choir", "strings", "lead", "synthbass", "timpani", "dguitar", "leadgtr", "drums_elec"]) expect(used.has(inst), inst).toBe(false);
  });
});

function cinrockState(mode: ConductorState["mode"], intensity: number, speedKmh: number): ConductorState {
  return {
    bpm: 140,
    targetBpm: 140,
    intensity,
    brightness: 0.6,
    transpose: 0,
    mode,
    grade: null,
    elevationTrend: "unknown",
    cruiseSeconds: 40,
    musicalGear: 3,
    speedKmh,
  };
}

describe("cinematic rock arrangement", () => {
  it("stays at 105 BPM, keeps a lead at idle, and keeps the shared rock genre", () => {
    const tl = createTimeline("cinrock", 0, 1);
    const stopped = tl.scheduleUntil(8, cinrockState("stopped", 0.1, 0));
    const lead = stopped.filter((n) => n.inst === "rocklead").map((n) => n.midi);
    expect(lead.length).toBeGreaterThan(8);
    expect(new Set(lead).size).toBeGreaterThan(2);
    expect(stopped.some((n) => n.inst === "cleangtr")).toBe(true);
    expect(stopped.some((n) => n.inst === "ebass")).toBe(true);
    expect(stopped.filter((n) => n.inst === "drums_rock")).toHaveLength(0);
    expect(tl.bpm).toBe(105);
    const rock = GENRES.rock.pattern({
      step: 0, bar: 0, chord: [40, 44, 47], root: 40, intensity: 0.2, mode: "cruise", variation: 0, stepDur: 0.12, barDur: 1.9, rand: () => 0.2,
    });
    expect(rock.some((n) => n.inst === "piano")).toBe(true);
    expect(autoDjPool()).not.toContain("cinrock");
  });

  it("holds a muted groove while cruising and opens power chords only on surge", () => {
    const cruise = createTimeline("cinrock", 0, 2);
    const cruising = cruise.scheduleUntil(20, cinrockState("cruise", 0.55, 70));
    expect(cruising.some((n) => n.inst === "dguitar")).toBe(true);
    expect(cruising.some((n) => n.inst === "ebass")).toBe(true);
    expect(cruising.some((n) => n.inst === "rocklead")).toBe(true);
    expect(cruising.some((n) => n.inst === "drums_rock" && n.midi === 38)).toBe(true);
    expect(cruising.some((n) => n.inst === "rockgtr")).toBe(false);
    expect(cruising.filter((n) => n.inst === "drums_rock" && (n.midi === 45 || n.midi === 48 || n.midi === 50))).toHaveLength(0);

    const surge = createTimeline("cinrock", 0, 2);
    surge.pushAccents(["surge"]);
    const lifting = surge.scheduleUntil(6, cinrockState("surge", 0.85, 40));
    expect(lifting.some((n) => n.inst === "rockgtr")).toBe(true);
    expect(lifting.filter((n) => n.inst === "drums_rock" && (n.midi === 45 || n.midi === 48 || n.midi === 50)).length).toBeGreaterThan(0);
    const after = surge.scheduleUntil(16, cinrockState("cruise", 0.55, 70));
    const later = after.filter((n) => n.time > 6);
    expect(later.filter((n) => n.inst === "drums_rock" && (n.midi === 45 || n.midi === 48 || n.midi === 50))).toHaveLength(0);
    expect(later.some((n) => n.inst === "rockgtr")).toBe(false);
  });

  it("fires one surge fill for a hard acceleration and none while cruising", () => {
    const c = createConductor({ bpmMin: 105, bpmMax: 105 });
    drive(c, 8, { speed: 20, acceleration: 0.1, throttle: 0.3 });
    c.drainAccents();
    drive(c, 4, { speed: 20.4, acceleration: 0.2, throttle: 0.35 });
    expect(c.drainAccents().filter((a) => a === "surge")).toEqual([]);
    const accents: string[] = [];
    const dt = 1 / 30;
    let speed = 22;
    for (let i = 0; i < 90; i++) {
      speed += 0.12;
      c.update({ speed, acceleration: 2.4, throttle: 0.9, regen: 0, gear: 0, dt });
      accents.push(...c.drainAccents());
    }
    expect(accents.filter((a) => a === "surge")).toHaveLength(1);
  });
});

describe("bollywood rickshaw arrangement", () => {
  it("keeps a 104 BPM hook, answers on the next bar, and stays quiet when stopped", () => {
    expect(resolveGenre("bollywood-rickshaw", "rock")).toBe("bwood");
    expect(autoDjPool()).not.toContain("bwood");
    const tl = createTimeline("bwood", 0, 1);
    expect(tl.scheduleUntil(4, cinrockState("stopped", 0.1, 0))).toHaveLength(0);
    expect(tl.bpm).toBe(104);
    const cruise = createTimeline("bwood", 0, 4);
    const notes = cruise.scheduleUntil(8, cinrockState("cruise", 0.55, 40));
    const flute = notes.filter((n) => n.inst === "flute").map((n) => n.midi);
    expect(flute).toEqual(expect.arrayContaining([62, 64, 67, 66]));
    expect(notes.some((n) => n.inst === "nylon")).toBe(true);
    expect(notes.some((n) => n.inst === "drums_rock" && n.midi === 45)).toBe(true);
    expect(notes.filter((n) => n.inst === "drums_rock" && (n.midi === 48 || n.midi === 50))).toHaveLength(0);
    const surge = createTimeline("bwood", 0, 4);
    surge.pushAccents(["surge"]);
    const lifted = surge.scheduleUntil(3, cinrockState("surge", 0.9, 30));
    expect(lifted.filter((n) => n.inst === "drums_rock" && (n.midi === 48 || n.midi === 50)).length).toBeGreaterThan(0);
  });

  it("does not restart the hook or refill on small throttle changes", () => {
    const c = createConductor({ bpmMin: 104, bpmMax: 104 });
    drive(c, 6, { speed: 12, acceleration: 0.05, throttle: 0.4 });
    c.drainAccents();
    const blips: string[] = [];
    const dt = 1 / 30;
    for (let i = 0; i < 40; i++) {
      c.update({ speed: 12.2, acceleration: i % 2 ? 0.35 : -0.2, throttle: i % 2 ? 0.55 : 0.25, regen: 0, gear: 0, dt });
      blips.push(...c.drainAccents());
    }
    expect(blips.filter((a) => a === "surge")).toEqual([]);
    expect(c.snapshot().mode === "stopped").toBe(false);
  });
});
