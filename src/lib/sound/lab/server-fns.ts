import { createServerFn } from "@tanstack/react-start";
import {
  assertAudioLabAccess,
  isAudioLabSecretConfigured,
} from "@/lib/sound/lab/access";

export const getAudioLabAccessConfiguredFn = createServerFn({ method: "POST" }).handler(() => ({
  configured: isAudioLabSecretConfigured(),
  /** DEV UI is always allowed in the browser when import.meta.env.DEV. */
  note: "Deployed access requires ELCAMOSO_AUDIO_LAB_SECRET or ELCAMOSO_BILLING_ADMIN_SECRET — not a hidden URL alone.",
}));

export const verifyAudioLabAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: { labSecret: string }) => data)
  .handler(async ({ data }) => {
    assertAudioLabAccess(data.labSecret);
    return { ok: true as const };
  });
