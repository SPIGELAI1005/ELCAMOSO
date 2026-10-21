/**
 * QR codes must be dark-on-light with a 4-module quiet zone. Native iPhone/Android
 * cameras often ignore inverted (light-on-dark) or tight-margin codes.
 */
export const SCANNABLE_QR_OPTIONS = {
  margin: 4,
  width: 512,
  errorCorrectionLevel: "M",
  color: { dark: "#000000", light: "#FFFFFF" },
} as const;

/** Absolute https origin for QR links; previews/localhost keep their own origin. */
export function qrOrigin(): string {
  if (typeof window === "undefined") return "https://www.elcamoso.com";
  const { hostname, origin } = window.location;
  if (hostname === "elcamoso.com" || hostname.endsWith(".elcamoso.com")) {
    return "https://www.elcamoso.com";
  }
  return origin;
}
