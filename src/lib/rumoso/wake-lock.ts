/**
 * Keep the screen on during a RUMOSO run.
 *
 * Prefers the Screen Wake Lock API and re-acquires it when the page becomes
 * visible again (the browser drops the lock on hide). A muted, no-audio
 * canvas-stream video is used only when the API is missing and captureStream
 * is available. We never play a silent soundtrack (unlike some NoSleep
 * ports), so music and coach voices are left alone. Older iOS without either
 * mechanism returns mode "none" and the UI should show the manual hint.
 */

export type WakeLockMode = "wakelock" | "video" | "none";

export const WAKE_LOCK_UNSUPPORTED_HINT =
  "Keep the screen on manually — set Auto-Lock to Never.";

export const SCREEN_LOCK_LIMIT_NOTE =
  "The side button or a screen lock still pauses web apps.";

export interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
}

export interface WakeLockNavigatorLike {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

export interface WakeLockDocumentLike {
  visibilityState: string;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface RumosoWakeLock {
  mode: WakeLockMode;
  release: () => void;
}

export interface AcquireWakeLockOptions {
  nav?: WakeLockNavigatorLike;
  doc?: WakeLockDocumentLike;
  /** Optional override used in tests. When omitted, a no-audio canvas fallback is tried. */
  tryVideoFallback?: () => (() => void) | null;
}

export function isScreenWakeLockSupported(nav: WakeLockNavigatorLike | undefined = undefined): boolean {
  const source = nav ?? (typeof navigator === "undefined" ? undefined : (navigator as WakeLockNavigatorLike));
  return Boolean(source?.wakeLock && typeof source.wakeLock.request === "function");
}

/**
 * Start a tiny muted looping video with no audio track. Returns null when
 * captureStream is unavailable (typical of older iOS) so we don't risk a
 * soundtrack that could steal the audio session from RUMOSO's music.
 */
export function startSilentVideoFallback(): (() => void) | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    const cap = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
      .captureStream;
    if (typeof cap !== "function") return null;
    const stream = cap.call(canvas, 1);
    if (stream.getAudioTracks().length > 0) {
      stream.getAudioTracks().forEach((t) => t.stop());
    }
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("aria-hidden", "true");
    video.loop = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0";
    document.body.appendChild(video);
    let frame = 0;
    const tick = window.setInterval(() => {
      if (ctx) {
        ctx.fillStyle = frame++ % 2 ? "#000" : "#010101";
        ctx.fillRect(0, 0, 2, 2);
      }
    }, 1000);
    void video.play().catch(() => {});
    return () => {
      window.clearInterval(tick);
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      video.remove();
      stream.getTracks().forEach((t) => t.stop());
    };
  } catch {
    return null;
  }
}

export async function acquireRumosoWakeLock(options: AcquireWakeLockOptions = {}): Promise<RumosoWakeLock> {
  const nav = options.nav ?? (typeof navigator === "undefined" ? undefined : (navigator as WakeLockNavigatorLike));
  const doc =
    options.doc ??
    (typeof document === "undefined" ? undefined : (document as unknown as WakeLockDocumentLike));

  if (isScreenWakeLockSupported(nav) && nav?.wakeLock) {
    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;
    const onSentinelRelease = () => {
      sentinel = null;
    };
    const acquire = async () => {
      try {
        if (sentinel && !sentinel.released) {
          sentinel.removeEventListener?.("release", onSentinelRelease);
          await sentinel.release().catch(() => {});
        }
      } catch {
        /* previous sentinel already gone */
      }
      sentinel = null;
      try {
        sentinel = await nav.wakeLock!.request("screen");
        sentinel.addEventListener?.("release", onSentinelRelease);
      } catch {
        sentinel = null;
      }
    };
    const onVis = () => {
      if (!released && doc?.visibilityState === "visible") void acquire();
    };
    await acquire();
    // Keep listening even if the first request failed (lost user gesture,
    // or the page was hidden) so a later visibilitychange can retry.
    doc?.addEventListener("visibilitychange", onVis);
    const releaseLock = () => {
      released = true;
      doc?.removeEventListener("visibilitychange", onVis);
      const current = sentinel;
      sentinel = null;
      current?.removeEventListener?.("release", onSentinelRelease);
      void current?.release().catch(() => {});
    };
    if (sentinel) {
      return { mode: "wakelock", release: releaseLock };
    }
    return { mode: "none", release: releaseLock };
  }

  const tryVideo = options.tryVideoFallback ?? startSilentVideoFallback;
  const stop = tryVideo();
  if (stop) return { mode: "video", release: stop };
  return { mode: "none", release: () => {} };
}

/** Tracks whether a run wants the screen kept on, and releases on pause/stop. */
export class RumosoWakeLockSession {
  private handle: RumosoWakeLock | null = null;
  private wanted = false;
  mode: WakeLockMode | "off" = "off";

  async setActive(
    active: boolean,
    acquire: (options?: AcquireWakeLockOptions) => Promise<RumosoWakeLock> = acquireRumosoWakeLock,
    options?: AcquireWakeLockOptions,
  ): Promise<WakeLockMode | "off"> {
    if (active) {
      this.wanted = true;
      if (this.handle) return this.mode;
      const handle = await acquire(options);
      if (!this.wanted) {
        handle.release();
        this.mode = "off";
        return this.mode;
      }
      this.handle = handle;
      this.mode = handle.mode;
      return this.mode;
    }
    this.wanted = false;
    this.handle?.release();
    this.handle = null;
    this.mode = "off";
    return this.mode;
  }
}
