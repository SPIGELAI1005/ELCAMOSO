import { describe, expect, it } from "vitest";
import { cardTheme, resolveTheme } from "./themes";

describe("card themes", () => {
  it("falls back to default for unknown or unowned themes", () => {
    expect(cardTheme("nope").id).toBe("default");
    expect(resolveTheme("theme-ember", []).id).toBe("default");
    expect(resolveTheme(null, ["theme-ember"]).id).toBe("default");
  });
  it("uses an owned theme", () => {
    expect(resolveTheme("theme-ember", ["theme-ember"]).id).toBe("theme-ember");
  });
});
