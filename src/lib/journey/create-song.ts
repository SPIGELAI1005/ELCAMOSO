import { composeDriveReel, composeDriveSong } from "./composer";
import { renderDriveSong } from "./render";
import { saveJourney, saveSongAudio, getJourney } from "./store";
import type { JourneySummary } from "./types";

export async function createDriveSongForJourney(
  journeyId: string,
  opts?: { symphonyPackId?: string; title?: string },
): Promise<JourneySummary | null> {
  const journey = await getJourney(journeyId);
  if (!journey) return null;

  const song = composeDriveSong(journey, {
    ...(opts?.symphonyPackId ? { symphonyPackId: opts.symphonyPackId } : {}),
    seed: journey.seed,
  });
  if (opts?.title) song.title = opts.title.slice(0, 48);
  const reel = composeDriveReel(song);

  let blob: Blob | null = null;
  try {
    blob = await renderDriveSong(journey, song);
    song.audioBlobId = journeyId;
    song.renderedAt = Date.now();
    await saveSongAudio(journeyId, blob);
  } catch {
    // Composition metadata still saved; render may fail without OfflineAudioContext
  }

  const next: JourneySummary = { ...journey, song, reel };
  await saveJourney(next);
  return next;
}
