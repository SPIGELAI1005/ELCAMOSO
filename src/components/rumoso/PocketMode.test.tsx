import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SCREEN_LOCK_LIMIT_NOTE } from "@/lib/rumoso/wake-lock";

import { PocketMode } from "./PocketMode";

describe("PocketMode", () => {
  it("shows dim run stats and a hold-to-unlock control", () => {
    const html = renderToStaticMarkup(
      <PocketMode elapsedMs={12 * 60_000} distanceM={2100} paceSec={343} effort={54} onUnlock={() => {}} />,
    );
    expect(html).toContain("data-testid=\"rumoso-pocket-mode\"");
    expect(html).toContain("data-testid=\"rumoso-pocket-unlock\"");
    expect(html).toContain("Hold to unlock");
    expect(html).toContain("12:00");
    expect(html).toContain("2.10");
    expect(html).toContain("5:43");
    expect(html).toContain("Steady");
    expect(html).toContain("Time");
    expect(html).toContain("Distance");
    expect(html).toContain("Pace");
    expect(html).toContain("Effort");
    expect(html).toContain(SCREEN_LOCK_LIMIT_NOTE);
    expect(html).not.toContain("by ELCAMOSO");
    expect(html).not.toContain("Diagnostics");
  });
});
