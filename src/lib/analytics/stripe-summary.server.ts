/** Read-only Stripe summary for the admin dashboard. Returns null when Stripe isn't connected. */
export interface MoneySummary {
  connected: boolean;
  mode?: "live" | "test";
  activeSubscriptions?: number;
  lifetimePurchases?: number;
  revenue30d?: number;
  revenueAll?: number;
  currency?: string;
  error?: string;
}

export async function stripeSummary(): Promise<MoneySummary> {
  const key = process.env["STRIPE_SECRET_KEY"]?.trim();
  if (!key) return { connected: false };
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    let activeSubscriptions = 0;
    for await (const _s of stripe.subscriptions.list({ status: "active", limit: 100 })) {
      activeSubscriptions++;
      if (activeSubscriptions >= 5000) break;
    }
    let lifetimePurchases = 0;
    for await (const s of stripe.checkout.sessions.list({ limit: 100 })) {
      if (s.mode === "payment" && s.payment_status === "paid") lifetimePurchases++;
    }
    let revenue30d = 0;
    let revenueAll = 0;
    let currency = "eur";
    for await (const c of stripe.charges.list({ limit: 100 })) {
      if (c.status !== "succeeded") continue;
      const net = c.amount - (c.amount_refunded ?? 0);
      revenueAll += net;
      if (c.created >= since) revenue30d += net;
      currency = c.currency;
    }
    return {
      connected: true,
      mode: key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test",
      activeSubscriptions,
      lifetimePurchases,
      revenue30d: revenue30d / 100,
      revenueAll: revenueAll / 100,
      currency: currency.toUpperCase(),
    };
  } catch (e) {
    return { connected: true, error: e instanceof Error ? e.message.slice(0, 120) : "Stripe error" };
  }
}
