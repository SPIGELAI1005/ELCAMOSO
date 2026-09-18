import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";
import { assertTracePrivacy } from "@/lib/journey-trace/sampler";
import type { MotionCaptureProvider } from "./types";

function isJourneyTrace(value: unknown): value is JourneyTraceV1 {
  if (!value || typeof value !== "object") return false;
  const trace = value as Partial<JourneyTraceV1>;
  return (
    trace.version === 1 &&
    typeof trace.journeyId === "string" &&
    typeof trace.startedAt === "number" &&
    Array.isArray(trace.samples) &&
    Array.isArray(trace.semanticEvents) &&
    Array.isArray(trace.gaps) &&
    !!trace.summary &&
    assertTracePrivacy(trace as JourneyTraceV1)
  );
}

export interface NativeImportResult {
  importedIds: string[];
  recoveredIds: string[];
}

/** Idempotently imports native-completed traces into the web IndexedDB repository. */
export async function importNativeJourneys(
  provider: MotionCaptureProvider,
): Promise<NativeImportResult> {
  if (!provider.ownsJourneyPersistence) return { importedIds: [], recoveredIds: [] };
  const repository = getJourneyRepository();
  const pending = await provider.drainCompletedJourneys();
  const importedIds: string[] = [];
  const recoveredIds: string[] = [];
  const acknowledged: string[] = [];

  for (const candidate of pending) {
    if (!isJourneyTrace(candidate)) continue;
    const existing = await repository.loadJourney(candidate.journeyId);
    if (!existing || existing.status === "recording") {
      await repository.finalizeJourney(candidate);
      importedIds.push(candidate.journeyId);
      if (candidate.status === "incomplete" || candidate.summary.endedUnexpectedly) {
        recoveredIds.push(candidate.journeyId);
      }
    }
    acknowledged.push(candidate.journeyId);
  }
  await provider.acknowledgeJourneys(acknowledged);
  return { importedIds, recoveredIds };
}
