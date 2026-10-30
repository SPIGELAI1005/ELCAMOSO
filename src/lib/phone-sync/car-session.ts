/**
 * Car-side pairing session. Module-level so it survives page navigation
 * (pair on Symphony, keep driving on Drive). Expires after inactivity.
 */
import { openSyncChannel, type SyncChannel } from "./channel";
import { clearPhoneSample, isPhoneLive, reportPhoneSample } from "./fusion";
import { PAIR_IDLE_EXPIRE_MS, generatePairCode, parsePhoneSample } from "./protocol";

export type CarPairStatus =
  "idle" | "connecting" | "waiting" | "paired" | "disconnected" | "unavailable";

interface State {
  status: CarPairStatus;
  code: string | null;
}

let state: State = { status: "idle", code: null };
let channel: SyncChannel | null = null;
let lastMsgAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let everPaired = false;
const listeners = new Set<(s: State) => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

export function getCarPairState(): State {
  return state;
}

export function subscribeCarPair(fn: (s: State) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function startCarPairing(): Promise<void> {
  stopCarPairing();
  const code = generatePairCode();
  set({ status: "connecting", code });
  lastMsgAt = Date.now();
  everPaired = false;
  const ch = await openSyncChannel(
    code,
    {
      sample: (p) => {
        const s = parsePhoneSample(p);
        if (!s) return;
        lastMsgAt = Date.now();
        everPaired = true;
        reportPhoneSample(s);
        if (state.status !== "paired") set({ status: "paired" });
      },
      hello: () => {
        lastMsgAt = Date.now();
        channel?.send("welcome", { ok: true });
      },
      bye: () => {
        clearPhoneSample();
        set({ status: "disconnected" });
      },
    },
    (st) => {
      if (st === "SUBSCRIBED" && state.status === "connecting") set({ status: "waiting" });
      if ((st === "CHANNEL_ERROR" || st === "TIMED_OUT") && state.status === "connecting")
        set({ status: "unavailable" });
    },
  );
  if (state.code !== code) {
    ch?.close();
    return;
  }
  if (!ch) {
    set({ status: "unavailable" });
    return;
  }
  channel = ch;
  timer = setInterval(() => {
    const now = Date.now();
    if (state.status === "paired" && !isPhoneLive(now)) set({ status: "disconnected" });
    if (now - lastMsgAt > PAIR_IDLE_EXPIRE_MS) stopCarPairing();
  }, 1000);
}

export function stopCarPairing() {
  if (timer) clearInterval(timer);
  timer = null;
  channel?.send("closed", {});
  channel?.close();
  channel = null;
  clearPhoneSample();
  void everPaired;
  set({ status: "idle", code: null });
}
