import type { Entitlement } from "@/lib/entitlements/types";

/** Product-facing upgrade contexts — benefit copy, not entitlement ids. */
export type PremiumContext =
  | "locked_sound"
  | "dynamic_drive"
  | "phone_pairing"
  | "advanced_controls";

export interface PremiumContextCopy {
  context: PremiumContext;
  entitlement: Entitlement;
  badge: string;
  title: string;
  body: string;
  ctaLabel: string;
  /** Secondary line under CTA — reassurance, not upsell pressure. */
  footnote?: string;
  /** Dismissible inline prompts unless access is genuinely required. */
  dismissible: boolean;
  pricingHref: "/pricing";
}

export const PREMIUM_CONTEXTS: Record<PremiumContext, PremiumContextCopy> = {
  locked_sound: {
    context: "locked_sound",
    entitlement: "all_sound_profiles",
    badge: "Drive+",
    title: "More character for the road",
    body: "This Sound Profile follows throttle, gears, and load — not just speed. The full library is part of Drive+.",
    ctaLabel: "See Drive+",
    footnote: "You can still preview here. Essential Drive stays free.",
    dismissible: true,
    pricingHref: "/pricing",
  },
  dynamic_drive: {
    context: "dynamic_drive",
    entitlement: "dynamic_drive",
    badge: "Drive+",
    title: "Sound that follows every gear",
    body: "Gears, load, and transients track how you drive. Preview Dynamic Drive free — Drive+ keeps it after your preview.",
    ctaLabel: "See Drive+",
    footnote: "Essential motion sound stays free without an account.",
    dismissible: true,
    pricingHref: "/pricing",
  },
  phone_pairing: {
    context: "phone_pairing",
    entitlement: "phone_sensor",
    badge: "Included",
    title: "Phone sensor pairing",
    body: "Basic Tesla ↔ phone QR pairing is included on Free. Drive+ unlocks premium profiles and Dynamic Drive.",
    ctaLabel: "See Drive+",
    dismissible: true,
    pricingHref: "/pricing",
  },
  advanced_controls: {
    context: "advanced_controls",
    entitlement: "advanced_controls",
    badge: "Drive+",
    title: "Tighter sync with your motion",
    body: "Fine-tune how closely sound follows movement — especially helpful on Bluetooth headphones.",
    ctaLabel: "See Drive+",
    dismissible: true,
    pricingHref: "/pricing",
  },
};

export function getPremiumContext(context: PremiumContext): PremiumContextCopy {
  return PREMIUM_CONTEXTS[context];
}

export function entitlementForPremiumContext(context: PremiumContext): Entitlement {
  return PREMIUM_CONTEXTS[context].entitlement;
}
