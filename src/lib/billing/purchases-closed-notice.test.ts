import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BILLING_PUBLIC_CONFIG_QUERY_KEY,
  PURCHASES_CLOSED_COPY,
  isPurchasesClosedNoticeVisible,
  usePurchasesClosedNotice,
} from "@/lib/billing/use-billing-public-config";

function Probe() {
  const closed = usePurchasesClosedNotice();
  return createElement("span", {
    "data-testid": "purchases-closed",
    "data-closed": closed ? "true" : "false",
  });
}

function renderProbe(client: QueryClient) {
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(Probe)),
  );
}

describe("purchases-closed notice visibility", () => {
  it("is hidden until public config has loaded, even if data looks off", () => {
    expect(isPurchasesClosedNoticeVisible({ isSuccess: false })).toBe(false);
    expect(
      isPurchasesClosedNoticeVisible({
        isSuccess: false,
        data: { monetizationEnabled: false },
      }),
    ).toBe(false);
  });

  it("is hidden when monetization is on", () => {
    expect(
      isPurchasesClosedNoticeVisible({
        isSuccess: true,
        data: { monetizationEnabled: true },
      }),
    ).toBe(false);
  });

  it("is shown only after config loaded and monetization is off", () => {
    expect(
      isPurchasesClosedNoticeVisible({
        isSuccess: true,
        data: { monetizationEnabled: false },
      }),
    ).toBe(true);
  });

  it("does not flash the closed note on SSR / before the billing query resolves", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    const html = renderProbe(client);
    expect(html).toContain('data-closed="false"');
    expect(html).not.toContain(PURCHASES_CLOSED_COPY);
  });

  it("shows closed once the query cache has monetizationEnabled=false", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    client.setQueryData(BILLING_PUBLIC_CONFIG_QUERY_KEY, {
      monetizationEnabled: false,
      available: false,
    });
    expect(renderProbe(client)).toContain('data-closed="true"');
  });

  it("stays hidden when the query cache has monetizationEnabled=true", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    client.setQueryData(BILLING_PUBLIC_CONFIG_QUERY_KEY, {
      monetizationEnabled: true,
      available: true,
    });
    expect(renderProbe(client)).toContain('data-closed="false"');
  });
});
