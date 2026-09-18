import { describe, expect, it } from "vitest";

import { sanitizeMonetizationMeta } from "@/lib/telemetry/monetization-analytics";

describe("sanitizeMonetizationMeta", () => {
  it("passes allowed monetization fields", () => {
    expect(
      sanitizeMonetizationMeta({
        source: "pricing",
        plan: "drive_plus",
        interval: "yearly",
        context: "locked_sound",
      }),
    ).toEqual({
      source: "pricing",
      plan: "drive_plus",
      interval: "yearly",
      context: "locked_sound",
    });
  });

  it("drops motion and location fields", () => {
    expect(
      sanitizeMonetizationMeta({
        source: "drive",
        latitude: 48.1,
        route: "secret",
        telemetry: "raw",
      } as never),
    ).toEqual({ source: "drive" });
  });
});

describe("monetizationMetaFromStripeMetadata", () => {
  it("maps checkout metadata to monetization meta", async () => {
    const { monetizationMetaFromStripeMetadata } =
      await import("@/lib/telemetry/monetization-analytics");
    expect(
      monetizationMetaFromStripeMetadata({
        source: "pricing",
        interval: "yearly",
      }),
    ).toEqual({
      source: "pricing",
      plan: "drive_plus",
      interval: "yearly",
    });
  });
});
