import { describe, expect, it } from "vitest";

import {
  canonicalAccountEmail,
  emailLookupAliases,
  emailsAreSameAccount,
  normalizeAccountEmail,
} from "./canonical-email";

describe("canonical account email", () => {
  it("trims and lower-cases", () => {
    expect(normalizeAccountEmail("  George.M.Neacsu@GoogleMail.com ")).toBe(
      "george.m.neacsu@googlemail.com",
    );
  });

  it("treats googlemail.com as gmail.com", () => {
    expect(canonicalAccountEmail("George.M.Neacsu@GoogleMail.com")).toBe(
      "george.m.neacsu@gmail.com",
    );
    expect(canonicalAccountEmail("george.m.neacsu@gmail.com")).toBe("george.m.neacsu@gmail.com");
  });

  it("does not rewrite other domains", () => {
    expect(canonicalAccountEmail("  Driver@Example.COM ")).toBe("driver@example.com");
  });

  it("lists both Gmail spellings for lookup", () => {
    expect(emailLookupAliases("george.m.neacsu@googlemail.com")).toEqual([
      "george.m.neacsu@gmail.com",
      "george.m.neacsu@googlemail.com",
    ]);
    expect(emailLookupAliases("george.m.neacsu@gmail.com")).toEqual([
      "george.m.neacsu@gmail.com",
      "george.m.neacsu@googlemail.com",
    ]);
    expect(emailLookupAliases("driver@example.com")).toEqual(["driver@example.com"]);
  });

  it("compares aliases as the same account", () => {
    expect(
      emailsAreSameAccount("george.m.neacsu@googlemail.com", "george.m.neacsu@gmail.com"),
    ).toBe(true);
    expect(emailsAreSameAccount("a@example.com", "b@example.com")).toBe(false);
  });
});
