/**
 * Turns raw DeviceMotion into longitudinal / lateral / bump values without knowing
 * how the phone is mounted: gravity direction comes from accelerationIncludingGravity,
 * forward direction is learned from GPS speed changes (fallback: largest horizontal axis).
 */
type V = [number, number, number];

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V) => Math.sqrt(dot(a, a));
const norm = (a: V): V => {
  const l = len(a);
  return l > 1e-6 ? scale(a, 1 / l) : [0, 0, 0];
};

export class MotionEstimator {
  private gravity: V = [0, 0, 9.81];
  private forward: V | null = null;
  private long = 0;
  private lat = 0;
  private bump = 0;

  /** Feed one DeviceMotion sample (m/s²). */
  push(withGravity: V, linear: V | null, dt: number) {
    const a = Math.min(1, dt / 0.8);
    this.gravity = [
      this.gravity[0] + (withGravity[0] - this.gravity[0]) * a,
      this.gravity[1] + (withGravity[1] - this.gravity[1]) * a,
      this.gravity[2] + (withGravity[2] - this.gravity[2]) * a,
    ];
    const lin = linear ?? sub(withGravity, this.gravity);
    const up = norm(this.gravity);
    const vert = dot(lin, up);
    const horiz = sub(lin, scale(up, vert));
    const k = Math.min(1, dt / 0.25);
    this.bump += (Math.abs(vert) - this.bump) * Math.min(1, dt / 0.1);
    if (this.forward) {
      const f = norm(sub(this.forward, scale(up, dot(this.forward, up))));
      const side: V = [
        up[1] * f[2] - up[2] * f[1],
        up[2] * f[0] - up[0] * f[2],
        up[0] * f[1] - up[1] * f[0],
      ];
      this.long += (dot(horiz, f) - this.long) * k;
      this.lat += (dot(horiz, side) - this.lat) * k;
    } else {
      this.long += (0 - this.long) * k;
      this.lat += (len(horiz) - this.lat) * k;
    }
  }

  /**
   * Learn forward axis: when GPS says we're clearly speeding up/slowing down,
   * the horizontal accel direction (signed) is forward.
   */
  learnForward(gpsAccel: number, withGravity: V) {
    if (Math.abs(gpsAccel) < 1.0) return;
    const up = norm(this.gravity);
    const lin = sub(withGravity, this.gravity);
    const horiz = sub(lin, scale(up, dot(lin, up)));
    if (len(horiz) < 0.5) return;
    const dir = scale(norm(horiz), Math.sign(gpsAccel));
    this.forward = this.forward
      ? norm([
          this.forward[0] * 0.8 + dir[0] * 0.2,
          this.forward[1] * 0.8 + dir[1] * 0.2,
          this.forward[2] * 0.8 + dir[2] * 0.2,
        ])
      : dir;
  }

  hasForward() {
    return this.forward != null;
  }

  read() {
    return {
      longAccel: this.forward ? this.long : null,
      latAccel: this.lat,
      bump: this.bump,
    };
  }
}
