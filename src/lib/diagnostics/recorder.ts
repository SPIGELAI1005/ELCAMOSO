import type { DriveDiagnosticsFrame } from "@/lib/diagnostics/types";

const MAX_FRAMES = 60;
const MIN_INTERVAL_MS = 500;

/** Ring buffer for a short (~30 s) diagnostics session at 2 Hz. */
export class DiagnosticsSessionRecorder {
  private frames: DriveDiagnosticsFrame[] = [];
  private lastAt = 0;

  record(frame: DriveDiagnosticsFrame, now = Date.now()) {
    if (now - this.lastAt < MIN_INTERVAL_MS) return;
    this.lastAt = now;
    this.frames.push(frame);
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
  }

  snapshot(): DriveDiagnosticsFrame[] {
    return [...this.frames];
  }

  clear() {
    this.frames = [];
    this.lastAt = 0;
  }
}
