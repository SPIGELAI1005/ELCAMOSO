import type { JourneyTraceV1 } from "@/lib/journey-trace/types";
import { composeDriveReel, composeDriveSong } from "./composer";
import { renderDriveSong } from "./render";
import { saveJourney, saveSongAudio, getJourney } from "./store";
import type { JourneySummary } from "./types";

export interface CreateDriveSongResult {
  journey: JourneySummary;
  /** Rendered audio (WAV) - null when rendering failed. */
  audio: Blob | null;
  /** Plain-words reason when the audio could not be created. */
  renderError: string | null;
}

/**
 * Compose + render a Drive Song. When the recorded trace is passed, the song follows
 * the real speed / acceleration / braking of the drive.
 */
export async function createDriveSongWithAudio(
  journeyId: string,
  opts?: { symphonyPackId?: string; title?: string; trace?: JourneyTraceV1 | null },
): Promise<CreateDriveSongResult | null> {
  const journey = await getJourney(journeyId);
  if (!journey) return null;

  const song = composeDriveSong(journey, {
    ...(opts?.symphonyPackId ? { symphonyPackId: opts.symphonyPackId } : {}),
    seed: journey.seed,
  });
  if (opts?.title) song.title = opts.title.slice(0, 48);
  const reel = composeDriveReel(song);

  let audio: Blob | null = null;
  let renderError: string | null = null;
  try {
    audio = await renderDriveSong(journey, song, { trace: opts?.trace ?? null });
    song.audioBlobId = journeyId;
    song.renderedAt = Date.now();
    await saveSongAudio(journeyId, audio);
  } catch (err) {
    renderError =
      err instanceof Error && err.message
        ? err.message
        : "This browser could not create the audio.";
    if (typeof console !== "undefined") console.warn("[drive-song] render failed", err);
  }

  const next: JourneySummary = { ...journey, song, reel };
  await saveJourney(next);
  return { journey: next, audio, renderError };
}

/** Back-compat wrapper (metadata only). Prefer createDriveSongWithAudio. */
export async function createDriveSongForJourney(
  journeyId: string,
  opts?: { symphonyPackId?: string; title?: string; trace?: JourneyTraceV1 | null },
): Promise<JourneySummary | null> {
  const r = await createDriveSongWithAudio(journeyId, opts);
  return r?.journey ?? null;
}
