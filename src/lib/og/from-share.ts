import { energySamplesFromTimeline } from "@/lib/motion-signature";
import type { JourneySharePayload } from "@/lib/journey";
import { toPublicDriveShareMetadata, type PublicDriveShareMetadata } from "@/lib/og";

/** Map decoded share → privacy-safe OG metadata including Motion Signature energy. */
export function publicMetaFromJourneyShare(
  payload: JourneySharePayload,
): PublicDriveShareMetadata | null {
  const durationMin = payload.durationMs
    ? `${Math.max(1, Math.round(payload.durationMs / 60000))} min`
    : "";
  const chapters = payload.sections?.length > 0 ? `${payload.sections.length} chapters` : "";
  return toPublicDriveShareMetadata({
    songTitle: payload.title,
    experienceName: payload.experienceName,
    driveDnaArchetype: payload.dna?.archetype,
    durationCategory: [durationMin, chapters].filter(Boolean).join(" · "),
    publicDriveDnaValues: payload.dna
      ? {
          energy: payload.dna.energy,
          flow: payload.dna.flow,
          rhythm: payload.dna.rhythm,
          variation: payload.dna.variation,
          regen: payload.dna.regen,
        }
      : undefined,
    energySamples: energySamplesFromTimeline(payload.energyTimeline, 24),
    seed: String(payload.seed ?? payload.title),
    version: String(payload.v ?? 1),
  });
}
