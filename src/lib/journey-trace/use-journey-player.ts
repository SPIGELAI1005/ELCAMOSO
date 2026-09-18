import { useCallback, useEffect, useRef, useState } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import {
  getJourneyRepository,
  journeyReplaySeed,
  JourneyTraceReplaySource,
  type JourneyInterpretationV1,
  type JourneyTraceV1,
} from "@/lib/journey-trace";
import { experienceForProfileId, type ExperienceKind } from "@/lib/experiences";
import { listRemixOptions } from "./remix-catalog";

export function useJourneyPlayer(journeyId: string) {
  const snap = useSessionStore();
  const [trace, setTrace] = useState<JourneyTraceV1 | null>(null);
  const [interpretations, setInterpretations] = useState<JourneyInterpretationV1[]>([]);
  const [family, setFamily] = useState<ExperienceKind>("engine");
  const [profileId, setProfileId] = useState("gt-v8");
  const [seed, setSeed] = useState(() => journeyReplaySeed(journeyId));
  const [parkedPlayheadMs, setParkedPlayheadMs] = useState(0);
  const [note, setNote] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = await getJourneyRepository().loadJourney(journeyId);
      if (cancelled) return;
      setTrace(t);
      setSeed(journeyReplaySeed(journeyId));
      setParkedPlayheadMs(0);
      if (t?.captureProfileId) {
        setProfileId(t.captureProfileId);
        setFamily(experienceForProfileId(t.captureProfileId).kind);
      }
      const interps = await getJourneyRepository().listInterpretations(journeyId);
      if (!cancelled) setInterpretations(interps);
      loaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId]);

  useEffect(() => {
    return () => {
      const s = getSession();
      if (s.snapshot().kind === "replay" || s.snapshot().kind === "ab") s.stop();
    };
  }, []);

  const playing =
    (snap.kind === "replay" || snap.kind === "ab") &&
    snap.status === "running" &&
    !snap.journeyReplayPaused;
  const replayIsLoaded = snap.kind === "replay" || snap.kind === "ab";
  const playheadMs = replayIsLoaded ? (snap.journeyReplayPlayheadMs ?? 0) : parkedPlayheadMs;

  const play = useCallback(async () => {
    if (!trace || !trace.samples.length) {
      setNote("This journey has no motion samples to replay.");
      return;
    }
    const session = getSession();
    if (
      (session.snapshot().kind === "replay" || session.snapshot().kind === "ab") &&
      session.snapshot().journeyReplayPaused
    ) {
      session.resumeJourneyReplay();
      return;
    }
    const source = new JourneyTraceReplaySource(trace, { profileId });
    if (parkedPlayheadMs > 0) source.seekTo(parkedPlayheadMs);
    await session.startJourneyReplay(trace, source, { profileId, seed });
    setNote("");
  }, [trace, profileId, parkedPlayheadMs, seed]);

  const pause = useCallback(() => {
    getSession().pauseJourneyReplay();
  }, []);

  const restart = useCallback(() => {
    setParkedPlayheadMs(0);
    const session = getSession();
    if (session.snapshot().kind === "replay" || session.snapshot().kind === "ab") {
      session.restartJourneyReplay();
    }
  }, []);

  const seek = useCallback((ms: number) => {
    const session = getSession();
    if (session.snapshot().kind === "replay" || session.snapshot().kind === "ab") {
      session.seekJourneyReplay(ms);
    } else {
      setParkedPlayheadMs(ms);
    }
  }, []);

  const tryAnother = useCallback(
    async (nextProfileId: string, nextSeed = seed) => {
      setProfileId(nextProfileId);
      setSeed(nextSeed);
      const session = getSession();
      if (session.snapshot().kind === "replay" || session.snapshot().kind === "ab") {
        await session.switchJourneyInterpretation(nextProfileId, nextSeed);
      }
    },
    [seed],
  );

  const selectFamily = useCallback(
    async (nextFamily: ExperienceKind) => {
      setFamily(nextFamily);
      const options = listRemixOptions(nextFamily);
      const selected = options.some((option) => option.profileId === profileId)
        ? profileId
        : options[0]?.profileId;
      if (selected && selected !== profileId) await tryAnother(selected);
    },
    [profileId, tryAnother],
  );

  const saveRemix = useCallback(async () => {
    if (!trace) return;
    const interp: JourneyInterpretationV1 = {
      id: `interp-${Date.now()}`,
      journeyId: trace.journeyId,
      experienceId: profileId,
      experienceKind: family,
      seed,
      createdAt: Date.now(),
      label:
        listRemixOptions(family).find((option) => option.profileId === profileId)?.label ??
        profileId,
    };
    await getJourneyRepository().saveInterpretation(interp);
    const list = await getJourneyRepository().listInterpretations(trace.journeyId);
    setInterpretations(list);
    setNote("Remix saved.");
  }, [trace, profileId, family, seed]);

  const startAb = useCallback(
    async (profileA: string, profileB: string) => {
      if (!trace) return;
      const a = new JourneyTraceReplaySource(trace, { profileId: profileA });
      const b = new JourneyTraceReplaySource(trace, { profileId: profileB });
      await getSession().startJourneyAb(trace, a, b, profileA, profileB, seed);
      setNote("A/B same drive - tap Flip to compare.");
    },
    [trace, seed],
  );

  const stop = useCallback((preservePosition = true) => {
    const session = getSession();
    const ms = session.getJourneyReplayPlayheadMs();
    setParkedPlayheadMs(preservePosition ? ms : 0);
    session.stop();
  }, []);

  return {
    trace,
    interpretations,
    family,
    setFamily,
    selectFamily,
    profileId,
    setProfileId,
    seed,
    note,
    setNote,
    playing,
    playheadMs,
    durationMs: trace?.durationMs ?? 0,
    state: snap.state,
    ab: snap.ab,
    play,
    pause,
    restart,
    seek,
    tryAnother,
    saveRemix,
    startAb,
    stop,
    flipAb: () => getSession().flipAb(),
    setRate: (r: number) => getSession().setJourneyReplayRate(r),
  };
}
