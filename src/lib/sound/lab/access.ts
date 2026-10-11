import { timingSafeEqual } from "node:crypto";

/**
 * Server-side gate for deployed audio-lab access.
 * Local Vite DEV UI does not require this; production/staging must not rely on a hidden URL alone.
 */
export class AudioLabAccessDeniedError extends Error {
  constructor(message = "Audio lab access denied") {
    super(message);
    this.name = "AudioLabAccessDeniedError";
  }
}

function readLabSecret(): string | null {
  const dedicated = process.env["ELCAMOSO_AUDIO_LAB_SECRET"]?.trim();
  if (dedicated) return dedicated;
  const billing = process.env["ELCAMOSO_BILLING_ADMIN_SECRET"]?.trim();
  return billing || null;
}

export function isAudioLabSecretConfigured(): boolean {
  return Boolean(readLabSecret());
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Required for any non-DEV server operation that exposes lab captures. */
export function assertAudioLabAccess(providedSecret: string | null | undefined): void {
  const expected = readLabSecret();
  if (!expected) {
    throw new AudioLabAccessDeniedError(
      "Audio lab secret is not configured (ELCAMOSO_AUDIO_LAB_SECRET or ELCAMOSO_BILLING_ADMIN_SECRET)",
    );
  }
  const provided = providedSecret?.trim() ?? "";
  if (!provided || !secretsMatch(provided, expected)) {
    throw new AudioLabAccessDeniedError();
  }
}
