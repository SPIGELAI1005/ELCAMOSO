/**
 * Keep the phone screen on while the pair page is open (like a playing video).
 * Uses the Screen Wake Lock API (iOS 16.4+); re-acquires when the page becomes
 * visible again. Older browsers fall back to a muted, looping inline video.
 */
type Sentinel = {
  release: () => Promise<void>;
  addEventListener?: (t: string, f: () => void) => void;
};

export interface KeepAwake {
  mode: "wakelock" | "video" | "none";
  release: () => void;
}

// 1-frame silent MP4 is not bundled; a tiny generated canvas stream works on old iOS.
function startVideoFallback(): (() => void) | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    const cap = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
      .captureStream as ((fps: number) => MediaStream) | undefined;
    if (typeof cap !== "function") return null;
    const stream = cap.call(canvas, 1);
    const video = document.createElement("video");
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.loop = true;
    video.srcObject = stream;
    video.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0";
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
      video.remove();
      stream.getTracks().forEach((t) => t.stop());
    };
  } catch {
    return null;
  }
}

/** Must be called from a user gesture (tap). */
export async function keepScreenAwake(): Promise<KeepAwake> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (t: "screen") => Promise<Sentinel> };
  };
  if ("wakeLock" in navigator && nav.wakeLock) {
    let sentinel: Sentinel | null = null;
    let released = false;
    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        sentinel = null;
      }
    };
    const onVis = () => {
      if (!released && document.visibilityState === "visible") void acquire();
    };
    await acquire();
    if (sentinel) {
      document.addEventListener("visibilitychange", onVis);
      return {
        mode: "wakelock",
        release: () => {
          released = true;
          document.removeEventListener("visibilitychange", onVis);
          void (sentinel as Sentinel | null)?.release().catch(() => {});
        },
      };
    }
  }
  const stop = startVideoFallback();
  if (stop) return { mode: "video", release: stop };
  return { mode: "none", release: () => {} };
}
