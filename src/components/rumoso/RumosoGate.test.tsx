import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/rumoso/RumosoApp", () => ({
  RumosoApp: ({ accessEmail }: { accessEmail: string }) => (
    <div data-testid="rumoso-app">{accessEmail}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, hash, children }: { to: string; hash?: string; children: unknown }) => (
    <a href={hash ? `${to}#${hash}` : to}>{children as string}</a>
  ),
}));

import { RumosoComingSoon } from "./RumosoComingSoon";
import { RumosoGate } from "./RumosoGate";

describe("RumosoGate", () => {
  it("renders the app for an admin and does not show coming soon", () => {
    const html = renderToStaticMarkup(
      <RumosoGate result={{ ok: true, email: "george@example.com", dev: false }} />,
    );
    expect(html).toContain("data-testid=\"rumoso-app\"");
    expect(html).toContain("george@example.com");
    expect(html).not.toContain("rumoso-coming-soon");
    expect(html).not.toContain("coming soon");
  });

  it("renders coming soon when logged out, with no sign-in or admin copy", () => {
    const html = renderToStaticMarkup(
      <RumosoGate result={{ ok: false, status: 401, error: "unauthenticated" }} />,
    );
    expectComingSoon(html);
  });

  it("renders coming soon for a signed-in non-admin, with no sign-in or admin copy", () => {
    const html = renderToStaticMarkup(
      <RumosoGate result={{ ok: false, status: 403, error: "forbidden" }} />,
    );
    expectComingSoon(html);
  });
});

describe("RumosoComingSoon", () => {
  it("uses the RUMOSO lockup and a link back to experiences", () => {
    const html = renderToStaticMarkup(<RumosoComingSoon />);
    expectComingSoon(html);
    expect(html).toContain("RUMOSO, Running Motion Sound");
    expect(html).toContain('href="/#experiences"');
  });
});

function expectComingSoon(html: string) {
  expect(html).toContain("data-testid=\"rumoso-coming-soon\"");
  expect(html).toContain("Run the music — coming soon");
  expect(html).toContain("Back to experiences");
  expect(html).not.toContain("data-testid=\"rumoso-app\"");
  expect(html).not.toMatch(/sign in/i);
  expect(html).not.toMatch(/allowlist/i);
  expect(html).not.toMatch(/admin account/i);
  expect(html).not.toContain("by ELCAMOSO");
}
