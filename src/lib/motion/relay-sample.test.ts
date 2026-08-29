import { describe, expect, it } from "vitest";
import { parseRelayMessage } from "@/lib/drive-relay/protocol";
import { toRelayMotionPayload } from "@/lib/motion/relay-sample";

describe("relay motion sample", () => {
  it("strips latitude and longitude from wire payload", () => {
    const payload = toRelayMotionPayload({
      timestamp: 1000,
      source: "phone",
      speedKmh: 42.5,
      latitude: 48.1,
      longitude: 11.5,
      accelerationLongitudinal: 0.42,
    });
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("longitude");
    expect(payload.speedKmh).toBe(42.5);
  });

  it("parses motion relay messages", () => {
    const msg = parseRelayMessage({
      type: "motion",
      from: "phone",
      at: 1,
      seq: 2,
      sample: { timestamp: 100, source: "phone", speedKmh: 10 },
    });
    expect(msg?.type).toBe("motion");
    if (msg?.type === "motion") expect(msg.sample.speedKmh).toBe(10);
  });
});
