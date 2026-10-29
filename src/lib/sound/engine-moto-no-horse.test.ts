import { describe, expect, it, vi } from "vitest";

const live = { beds: new Set<string>(), snorts: new Set<string>() };

vi.mock("@/lib/sound/recorded-beds", async (orig) => {
  const real = await orig<typeof import("@/lib/sound/recorded-beds")>();
  class RecordedBed {
    constructor(_ctx: unknown, public cfg: { profileId: string }) {
      live.beds.add(cfg.profileId);
    }
    load() { return Promise.resolve(); }
    update() { return 0; }
    dispose() { live.beds.delete(this.cfg.profileId); }
  }
  return { ...real, RecordedBed };
});
vi.mock("@/lib/sound/horse-snorts", async (orig) => {
  const real = await orig<typeof import("@/lib/sound/horse-snorts")>();
  class HorseSnorts {
    constructor(_c: unknown, _d: unknown, public id: string) { live.snorts.add(id); }
    load() { return Promise.resolve(); }
    update() {}
    dispose() { live.snorts.delete(this.id); }
  }
  return { ...real, HorseSnorts };
});

import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";

/** Regression: carriage hooves/snorts kept playing under the motorcycles after a switch. */
describe("motorcycle profiles never carry horse or carriage layers", () => {
  for (const moto of ["motorcycle-inline-4", "v-twin-cruiser"]) {
    for (const from of ["wild-west-carriage", "romanian-85-carriage", "horse-gallop"]) {
      it(`${from} -> ${moto} stops the horse bed and snorts`, () => {
        live.beds.clear();
        live.snorts.clear();
        const engine = new SoundEngine() as unknown as {
          ctx: unknown; cabinIn: unknown; buildRecordedBed(p: unknown): void;
        };
        engine.ctx = {};
        engine.cabinIn = {};
        engine.buildRecordedBed(getProfile(from));
        expect(live.beds.size + live.snorts.size).toBeGreaterThan(0);
        engine.buildRecordedBed(getProfile(moto));
        expect([...live.beds]).toEqual([]);
        expect([...live.snorts]).toEqual([]);
      });
    }
  }
});
