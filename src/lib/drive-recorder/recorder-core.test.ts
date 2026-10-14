import { describe, expect, it } from "vitest";
import {
  classifyDrivingState,
  DriveRecorderCore,
  driveLogBlobPath,
  MOTION_MAX_HZ,
  ORIENTATION_MAX_HZ,
} from "./recorder-core";
import { handleDriveLogUpload, driveLogUploadConfigured } from "./upload.server";
import { gzipSync } from "node:zlib";

const T0 = 1_760_000_000_000;
const motion = {
  acceleration: { x: 0.1, y: 0.2, z: 0.3 },
  accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
  rotationRate: { alpha: 1, beta: 2, gamma: 3 },
  interval: 16,
};

describe("DriveRecorderCore", () => {
  it("downsamples 60 Hz motion to <= 20 Hz and orientation to <= 10 Hz while counting raw rate", () => {
    const c = new DriveRecorderCore({ startEpoch: T0 });
    for (let i = 0; i < 600; i++) {
      c.addMotion(T0 + i * (1000 / 60), motion);
      c.addOrientation(T0 + i * (1000 / 60), { alpha: 10, beta: 20, gamma: 30 });
    }
    expect(c.motion.length).toBeLessThanOrEqual(10 * MOTION_MAX_HZ + 1);
    expect(c.motion.length).toBeGreaterThanOrEqual(10 * MOTION_MAX_HZ - 5);
    expect(c.orientation.length).toBeLessThanOrEqual(10 * ORIENTATION_MAX_HZ + 1);
    const st = c.status(T0 + 10_000);
    expect(st.motion.rateHz).toBeGreaterThan(55);
    expect(st.motion.hasValues).toBe(true);
    expect(st.gps.totalEvents).toBe(0);
  });

  it("flags events that carry only nulls", () => {
    const c = new DriveRecorderCore({ startEpoch: T0 });
    c.addMotion(T0 + 100, { acceleration: { x: null, y: null, z: null }, rotationRate: null });
    expect(c.status(T0 + 200).motion.hasValues).toBe(false);
  });

  it("records GPS, derives throttle/state and summarises", () => {
    const c = new DriveRecorderCore({ startEpoch: T0 });
    for (let i = 0; i <= 20; i++) {
      c.addGps(T0 + i * 1000, {
        latitude: 52.5,
        longitude: 13.4,
        accuracy: 5,
        speed: i * 1.5,
        heading: i === 0 ? null : 90,
        altitude: null,
        altitudeAccuracy: null,
        timestamp: T0 + i * 1000,
      });
    }
    c.stop(T0 + 21_000);
    const log = c.toLog();
    expect(log.gps).toHaveLength(21);
    expect(log.derived).toHaveLength(21);
    expect(log.derived.at(-1)![6]).toBe("highway");
    expect(log.derived.at(-1)![3]).toBeGreaterThan(0);
    expect(log.summary.maxSpeedKmh).toBeCloseTo(108, 0);
    expect(log.summary.gpsHeadingProvided).toBe(20);
    expect(log.durationMs).toBe(21_000);
    const back = DriveRecorderCore.fromLog(JSON.parse(JSON.stringify(log)));
    expect(back.toLog().gps).toEqual(log.gps);
  });

  it("keeps a one-hour drive at a reasonable size", () => {
    const c = new DriveRecorderCore({ startEpoch: T0 });
    for (let ms = 0; ms < 3_600_000; ms += 50) {
      c.addMotion(T0 + ms, motion);
      if (ms % 100 === 0) c.addOrientation(T0 + ms, { alpha: 123.4, beta: 1.2, gamma: -3.4 });
      if (ms % 1000 === 0)
        c.addGps(T0 + ms, {
          latitude: 52.512345,
          longitude: 13.412345,
          accuracy: 4.2,
          speed: 13.9,
          heading: 181.2,
          altitude: 40,
          altitudeAccuracy: 3,
          timestamp: T0 + ms,
        });
    }
    const json = JSON.stringify(c.toLog(T0 + 3_600_000));
    expect(json.length).toBeLessThan(12_000_000);
    expect(gzipSync(json).length).toBeLessThan(4_000_000);
  });

  it("classifies driving states", () => {
    expect(classifyDrivingState(0)).toBe("stopped");
    expect(classifyDrivingState(3)).toBe("crawl");
    expect(classifyDrivingState(10)).toBe("city");
    expect(classifyDrivingState(20)).toBe("road");
    expect(classifyDrivingState(30)).toBe("highway");
  });

  it("builds safe blob paths under drive-logs/", () => {
    expect(driveLogBlobPath("../../evil id!", new Date("2026-10-14T10:00:00Z"))).toBe(
      "drive-logs/2026-10-14/evilid.json.gz",
    );
  });
});

describe("handleDriveLogUpload", () => {
  const gz = gzipSync(JSON.stringify({ a: 1 }));
  const req = (body: BodyInit) =>
    new Request("https://x.test/api/drive-logs?id=drive-1", { method: "POST", body });

  it("degrades with 503 when no token is configured", async () => {
    expect(driveLogUploadConfigured({})).toBe(false);
    const r = await handleDriveLogUpload(req(gz), { env: {} });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects non-gzip bodies", async () => {
    const r = await handleDriveLogUpload(req("{}"), { env: { BLOB_READ_WRITE_TOKEN: "t" } });
    expect(r).toMatchObject({ ok: false, status: 415 });
  });

  it("stores gzip logs under drive-logs/", async () => {
    let seen = "";
    const r = await handleDriveLogUpload(req(gz), {
      env: { BLOB_READ_WRITE_TOKEN: "t" },
      now: new Date("2026-10-14T10:00:00Z"),
      put: async (pathname) => {
        seen = pathname;
        return { pathname, url: `https://blob.test/${pathname}` };
      },
    });
    expect(seen).toBe("drive-logs/2026-10-14/drive-1.json.gz");
    expect(r).toMatchObject({ ok: true, pathname: seen });
  });
});
