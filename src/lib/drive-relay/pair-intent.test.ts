import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "@/lib/account/return-to";
import { isPairPath } from "./pair-intent";

describe("pair intent", () => {
  it("accepts only same-origin pair paths", () => {
    expect(isPairPath("/pair/abc_DEF-1?s=dragon&m=sport")).toBe(true);
    expect(isPairPath("//evil.com/pair/x")).toBe(false);
    expect(isPairPath("https://evil.com/pair/x")).toBe(false);
    expect(sanitizeReturnTo("/pair/abc?s=dragon")).toBe("/pair/abc?s=dragon");
    expect(sanitizeReturnTo("//evil.com/pair/abc")).toBe("/drive");
  });
});
