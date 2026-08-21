/**
 * Service operator details for Impressum / legal notices.
 * Aligned with the operator details used for ONE4Team (same provider).
 */
export interface LegalOperator {
  /** Display / trading name */
  serviceName: string;
  /** Owner / natural person operating the service */
  ownerName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  /** Public website URL */
  website: string;
  /** Last review date for legal pages (ISO date) */
  lastUpdated: string;
}

export const LEGAL_OPERATOR: LegalOperator = {
  serviceName: "ELCAMOSO",
  ownerName: "George-Mugurel Neacsu",
  street: "Maria-Sibylla-Merian-Strasse 12",
  postalCode: "80999",
  city: "Munich",
  country: "Germany",
  email: "support@elcamoso.com",
  website: "https://elcamoso.com",
  lastUpdated: "2026-08-21",
};

export function operatorAddressLines(): string[] {
  const o = LEGAL_OPERATOR;
  return [o.street, `${o.postalCode} ${o.city}`, o.country];
}

export const LEGAL_LINKS = [
  { to: "/legal/impressum" as const, label: "Impressum" },
  { to: "/legal/privacy" as const, label: "Privacy" },
  { to: "/legal/cookies" as const, label: "Cookies" },
  { to: "/legal/terms" as const, label: "Terms" },
  { to: "/legal/accessibility" as const, label: "Accessibility" },
];
