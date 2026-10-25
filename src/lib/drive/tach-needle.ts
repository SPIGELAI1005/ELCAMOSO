import { introNeedle } from "@/lib/drive/tach-theme";

export interface TachNeedleFrame {
  visual: number;
  intro: boolean;
}

export interface TachNeedleScheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
  now(): number;
}

/**
 * Drives the tach needle: intro sweep (redline and back) then live smoothing.
 *
 * One animation-frame handle for both phases. The old component used two effects
 * sharing a single rAF ref: replaying the intro after it had finished (introKey
 * change, e.g. settings/profile hydrating late on first Start Drive) let the
 * smoothing effect's cleanup cancel the new intro frame, leaving `intro` stuck
 * true and the needle frozen until the next mode switch.
 */
export class TachNeedleAnimator {
  private visual: number;
  private target: number;
  private intro = false;
  private introStart = 0;
  private introMs = 0;
  private handle: number | null = null;
  private reducedMotion: boolean;

  constructor(
    private readonly scheduler: TachNeedleScheduler,
    private readonly onFrame: (frame: TachNeedleFrame) => void,
    opts: { target: number; reducedMotion: boolean },
  ) {
    this.target = clamp01(opts.target);
    this.reducedMotion = opts.reducedMotion;
    this.visual = opts.reducedMotion ? this.target : 0;
  }

  snapshot(): TachNeedleFrame {
    return { visual: this.visual, intro: this.intro };
  }

  setTarget(target: number) {
    this.target = clamp01(target);
    if (this.reducedMotion) {
      this.visual = this.target;
      this.publish();
      return;
    }
    this.ensureRunning();
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      this.intro = false;
      this.visual = this.target;
      this.publish();
    } else {
      this.ensureRunning();
    }
  }

  /** (Re)play the intro sweep. Safe to call at any time, including mid-intro. */
  playIntro(introMs: number) {
    if (this.reducedMotion) {
      this.intro = false;
      this.visual = this.target;
      this.publish();
      return;
    }
    this.intro = true;
    this.introMs = Math.max(1, introMs);
    this.introStart = this.scheduler.now();
    this.publish();
    this.ensureRunning();
  }

  dispose() {
    this.stop();
  }

  private stop() {
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  private ensureRunning() {
    if (this.handle !== null) return;
    this.handle = this.scheduler.request(this.step);
  }

  private step = (now: number) => {
    this.handle = null;
    if (this.intro) {
      const t = (now - this.introStart) / this.introMs;
      if (t >= 1) {
        this.intro = false;
        this.visual = this.target;
      } else {
        this.visual = introNeedle(Math.max(0, t), this.target);
        this.publish();
        this.ensureRunning();
        return;
      }
    } else {
      const next = this.visual + (this.target - this.visual) * 0.12;
      this.visual = Math.abs(next - this.target) < 0.002 ? this.target : next;
    }
    this.publish();
    if (this.visual !== this.target) this.ensureRunning();
  };

  private publish() {
    this.onFrame({ visual: this.visual, intro: this.intro });
  }
}

function clamp01(v: number) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
