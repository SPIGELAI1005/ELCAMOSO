import "@/test-utils/install-web-audio";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOUND_ALIASES } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { GE_SQUARED_DRIVETRAIN } from "@/lib/sound/profiles-expansion";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { CoyoteV8Synth } from "./coyote-synth";
import { V10_RACE } from "./v10-shift";
import {
  COYOTE_V8_VOICING,
  GE_SQUARED_90_VOICING,
  GE_SQUARED_O_VOICING,
  afterfireStrength,
  coyoteVoicingFor,
  gritCurve,
} from "./voicing";

describe("Coyote voicing per profile", () => {
  it("American Muscle V8 and Police Patrol (alias) play the plain Coyote", () => {
    expect(coyoteVoicingFor("american-muscle-v8")).toBe(COYOTE_V8_VOICING);
    expect(SOUND_ALIASES["police-patrol"]?.base).toBe("american-muscle-v8");
    expect(coyoteVoicingFor("american-muscle-v8", "police-patrol")).toBe(COYOTE_V8_VOICING);
  });

  it("Ge-Squared O))) and '90 are built on the Coyote with their own voicing", () => {
    expect(coyoteVoicingFor("ge-squared")).toBe(GE_SQUARED_O_VOICING);
    expect(coyoteVoicingFor("ge-squared", "ge-squared")).toBe(GE_SQUARED_O_VOICING);
    expect(coyoteVoicingFor("ge-squared-90")).toBe(GE_SQUARED_90_VOICING);
  });

  it("Private Jet keeps the previous Ge-Squared engine and drivetrain", () => {
    expect(SOUND_ALIASES["private-jet"]?.base).toBe("ge-squared");
    expect(coyoteVoicingFor("ge-squared", "private-jet")).toBeNull();
    expect(getProfile("private-jet").transmission).toBe(GE_SQUARED_DRIVETRAIN.transmission);
    expect(getProfile("ge-squared").transmission).toBe(GE_SQUARED_DRIVETRAIN.transmission);
  });

  it("other engines are not Coyote sounds", () => {
    for (const id of ["racing-v10", "gt-v8", "big-twin", "traby", "rocket-car", "private-jet"]) {
      expect(coyoteVoicingFor(id)).toBeNull();
    }
    expect(coyoteVoicingFor(null)).toBeNull();
  });

  it("the V8 voicing is the identity (no tone chain, x1 levels, the V10 race values)", () => {
    const v = COYOTE_V8_VOICING;
    expect(v.tone).toBeNull();
    expect(v.afterfire).toBeNull();
    expect(v.valvetrain).toBeNull();
    expect(v.pops).toEqual({
      level: 1,
      rate: 1,
      extraPops: 0,
      raceLiftProbability: V10_RACE.liftPops.probability,
      crackle: 1,
      raceCrackProbability: V10_RACE.shiftCrackProbability,
      limiterPopProbability: V10_RACE.limiterPopProbability,
      limiterGateFloor: V10_RACE.limiterGateFloor,
      shiftGateFloor: V10_RACE.shiftGateFloor,
    });
  });
});

describe("Ge-Squared O))) voicing: brutal and raw", () => {
  const o = GE_SQUARED_O_VOICING;
  const v8 = COYOTE_V8_VOICING.pops;

  it("has grit, low-mid weight and a band-limited top (no fizz)", () => {
    expect(o.tone?.grit?.drive).toBeGreaterThan(4);
    expect(o.tone?.grit?.lowpassHz).toBeLessThanOrEqual(4500);
    expect(o.tone?.lowShelf.db).toBeGreaterThan(0);
    expect(o.tone?.highShelf.db).toBeLessThan(0);
    expect(o.tone?.lowpassHz).toBeLessThanOrEqual(7000);
  });

  it("pops louder, deeper and more often, with a harder limiter cut", () => {
    expect(o.pops.level).toBeGreaterThan(v8.level);
    expect(o.pops.rate).toBeLessThan(1);
    expect(o.pops.extraPops).toBeGreaterThan(0);
    expect(o.pops.raceLiftProbability).toBeGreaterThan(v8.raceLiftProbability);
    expect(o.pops.crackle).toBeGreaterThan(1);
    expect(o.pops.limiterGateFloor).toBeLessThan(v8.limiterGateFloor);
  });

  it("keeps the Ge-Squared afterfire bangs (existing asset, bang windows only)", () => {
    const af = o.afterfire!;
    expect(existsSync(join(process.cwd(), "public", af.url))).toBe(true);
    expect(af.bangs.length).toBeGreaterThan(0);
    for (const b of af.bangs) expect(b.end).toBeLessThanOrEqual(4);
    expect(afterfireStrength(af, af.minRpm - 1)).toBe(0);
    expect(afterfireStrength(af, af.fullRpm + 500)).toBe(1);
  });
});

describe("Ge-Squared '90 voicing: classic mechanical", () => {
  const c = GE_SQUARED_90_VOICING;
  const v8 = COYOTE_V8_VOICING.pops;

  it("is smooth and muffled with an intake mid and valvetrain ticks", () => {
    expect(c.tone?.grit).toBeNull();
    expect(c.tone?.lowpassHz).toBeLessThan(5000);
    expect(c.tone?.peak.db).toBeGreaterThan(0);
    expect(c.valvetrain?.level).toBeGreaterThan(0);
    expect(c.afterfire).toBeNull();
  });

  it("pops milder and less often, with a gentler overrun / limiter", () => {
    expect(c.pops.level).toBeLessThan(v8.level);
    expect(c.pops.extraPops).toBeLessThan(0);
    expect(c.pops.raceLiftProbability).toBeLessThan(v8.raceLiftProbability);
    expect(c.pops.raceCrackProbability).toBeLessThan(v8.raceCrackProbability);
    expect(c.pops.limiterPopProbability).toBeLessThan(v8.limiterPopProbability);
    expect(c.pops.crackle).toBeLessThan(1);
    expect(c.pops.limiterGateFloor).toBeGreaterThan(v8.limiterGateFloor);
    expect(c.pops.shiftGateFloor).toBeGreaterThan(v8.shiftGateFloor);
  });
});

describe("gritCurve", () => {
  it("is unity gain for small signals, bounded and asymmetric", () => {
    const c = gritCurve(12, 0.25, 2049);
    const mid = 1024;
    const slope = (c[mid + 1]! - c[mid - 1]!) / (2 * (2 / 2048));
    expect(slope).toBeCloseTo(1, 1);
    for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    expect(Math.abs(c[0]!)).not.toBeCloseTo(Math.abs(c[2048]!), 3);
  });
});

describe("CoyoteV8Synth with a voicing", () => {
  function build(voicing?: typeof COYOTE_V8_VOICING) {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    let created = 0;
    for (const k of [
      "createGain",
      "createBiquadFilter",
      "createWaveShaper",
      "createBufferSource",
    ]) {
      const orig = (ctx as unknown as Record<string, () => unknown>)[k]!.bind(ctx);
      (ctx as unknown as Record<string, () => unknown>)[k] = () => {
        created += 1;
        return orig();
      };
    }
    const g = () => ctx.createGain();
    const buses = { body: g(), accents: g(), beds: g(), profile: g() };
    const synth = new CoyoteV8Synth({ startup: false, voicing });
    synth.build(ctx, buses as unknown as StrategyBuses);
    const n = created;
    const d = synth.getDiagnostics();
    synth.dispose();
    return { n, d };
  }

  it("the V8 voicing builds exactly the default graph", () => {
    expect(build(COYOTE_V8_VOICING).n).toBe(build().n);
    expect(build().d.voicing).toBe("american-muscle-v8");
  });

  it("voiced profiles add only a small fixed chain", () => {
    const base = build().n;
    const o = build(GE_SQUARED_O_VOICING);
    const c = build(GE_SQUARED_90_VOICING);
    expect(o.d.voicing).toBe("ge-squared");
    expect(c.d.voicing).toBe("ge-squared-90");
    expect(o.n - base).toBeGreaterThan(0);
    expect(o.n - base).toBeLessThanOrEqual(12);
    expect(c.n - base).toBeLessThanOrEqual(12);
  });
});
