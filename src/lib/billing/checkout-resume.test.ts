import { describe, expect, it } from "vitest";

import { checkoutResumeReturnTo, readCheckoutResume } from "@/lib/billing/checkout-resume";

describe("checkout resume", () => {
  it("keeps the chosen package on the start page sign-in return", () => {
    expect(
      checkoutResumeReturnTo("/", {
        plan: "drive_music",
        interval: "monthly",
        source: "home",
      }),
    ).toBe("/?checkout=drive_music&interval=monthly&source=home");
  });

  it("reads the package and leaves the rest of the pricing query", () => {
    expect(
      readCheckoutResume(
        "/pricing?plan=drive-music&sound=gt-v8&checkout=drive_plus&interval=yearly&source=sound-share",
      ),
    ).toEqual({
      plan: "drive_plus",
      interval: "yearly",
      source: "sound-share",
      returnPath: "/pricing?plan=drive-music&sound=gt-v8",
    });
  });

  it("ignores a page with no pending purchase", () => {
    expect(readCheckoutResume("/pricing")).toBeNull();
    expect(readCheckoutResume("/?ref=abc")).toBeNull();
  });
});
