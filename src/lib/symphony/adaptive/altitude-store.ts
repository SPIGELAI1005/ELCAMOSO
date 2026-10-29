/** Latest GPS altitude from the browser. coords.altitude is often null (many in-car browsers). */
let latest: { altitude: number | null; accuracy: number | null; at: number } = {
  altitude: null,
  accuracy: null,
  at: 0,
};

export function reportGpsAltitude(altitude: number | null | undefined, accuracy: number | null | undefined) {
  latest = {
    altitude: typeof altitude === "number" && Number.isFinite(altitude) ? altitude : null,
    accuracy: typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null,
    at: Date.now(),
  };
}

/** Returns null altitude when the last fix is older than 15 s. */
export function readGpsAltitude(now = Date.now()) {
  if (now - latest.at > 15_000) return { altitude: null, accuracy: null };
  return { altitude: latest.altitude, accuracy: latest.accuracy };
}
