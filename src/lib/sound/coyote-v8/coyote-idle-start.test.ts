import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";

import type { StrategyBuses } from "@/lib/sound/realism/types";
import { CoyoteV8Synth } from "./coyote-synth";
import { COYOTE_IDLE_RPM } from "./model";

function build(options?: { startup?: boolean; onStartup?: () => void }) {
  const ctx = new globalThis.OfflineAudioContext(1, 48000 * 2, 48000);
  const g = () => ctx.createGain();
  const buses = { body: g(), accents: g(), beds: g(), profile: g() };
  for (const b of Object.values(buses)) b.connect(ctx.destination);
  const synth = new CoyoteV8Synth(options);
  synth.build(ctx, buses as unknown as StrategyBuses);
  return { ctx, synth };
}

describe("Coyote V8 before the first drive tick", () => {
  it("starts the idle loop as soon as the bank is ready, without waiting for update()", () => {
    // Drive can sit on "No motion yet" (parked, waiting for GPS) and never call update().
    const { ctx, synth } = build({ startup: false });
    expect(synth.getDiagnostics().activePoints).toEqual([]);
    synth.attachBuffer(ctx.createBuffer(1, 48000 * 61, 48000));
    const diag = synth.getDiagnostics();
    expect(diag.ready).toBe(true);
    expect(diag.activePoints.length).toBeGreaterThan(0);
    expect(Math.min(...diag.activePoints)).toBeLessThanOrEqual(COYOTE_IDLE_RPM * 1.4);
    synth.dispose();
  });

  it("reports the startup only when it is actually played", () => {
    let played = 0;
    const off = build({ startup: false, onStartup: () => (played += 1) });
    off.synth.attachBuffer(off.ctx.createBuffer(1, 48000 * 61, 48000));
    expect(played).toBe(0);
    off.synth.dispose();
    const on = build({ startup: true, onStartup: () => (played += 1) });
    on.synth.attachBuffer(on.ctx.createBuffer(1, 48000 * 61, 48000));
    expect(played).toBe(1);
    on.synth.dispose();
  });
});
