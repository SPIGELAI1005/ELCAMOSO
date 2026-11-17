import { describe, expect, it } from "vitest";
import { rumosoViewForAccess } from "@/components/rumoso/RumosoGate";

describe("rumoso access view", () => {
  it("shows the app to an admin", () => {
    expect(
      rumosoViewForAccess({ ok: true, email: "george@example.com", dev: false }),
    ).toBe("app");
  });

  it("shows coming soon when logged out", () => {
    expect(rumosoViewForAccess({ ok: false, status: 401, error: "unauthenticated" })).toBe(
      "coming-soon",
    );
  });

  it("shows coming soon to a signed-in non-admin", () => {
    expect(rumosoViewForAccess({ ok: false, status: 403, error: "forbidden" })).toBe(
      "coming-soon",
    );
  });
});
