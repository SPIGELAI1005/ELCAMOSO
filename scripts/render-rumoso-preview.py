#!/usr/bin/env python3
"""Render a headless RUMOSO desktop-simulation preview (walk, jog, push, cooldown).

Uses existing Viral Epic Party loop stems and Piper-rendered coach lines.
Does not claim a listening result.
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
STEM_DIR = ROOT / "public/audio/symphony/symphony-viral-mix"
VOICE_DIR = Path("/tmp/rumoso-voices")
OUT_DIR = Path("/workspace/rumoso/previews")
SR = 48_000
DURATION = 90.0

# Effort 0-100 → speed km/h = effort * 1.3; Viral Mix gate windows (in, full, max, stripOnDecel)
GATES = {
    "loop-beat.m4a": (0, 0, 1.0, False),
    "loop-claps.m4a": (0, 0, 1.0, False),
    "loop-accordion.m4a": (5, 22, 1.0, False),
    "loop-arena.m4a": (10, 28, 0.55, False),
    "loop-bass.m4a": (60, 78, 1.0, True),
    "loop-kit.m4a": (55, 90, 1.0, True),
    "loop-brass.m4a": (80, 100, 1.0, True),
    "loop-lead.m4a": (100, 128, 1.0, True),
}

VOICES = [
    # t_sec, filename, matches evaluateCoach on this 90s ramp (hard push, then drop after 45s cooldown)
    (52.0, "push-for-it.wav"),
    (78.0, "you-can-do-it.wav"),
]


def effort_at(t: float, total: float = DURATION) -> float:
    marks = [(0, 18), (16, 28), (36, 52), (50, 54), (62, 90), (72, 90), (total, 18)]
    for (t1, y1), (t0, y0) in zip(marks[1:], marks):
        if t <= t1:
            u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            smooth = u * u * (3 - 2 * u)
            return y0 + (y1 - y0) * smooth
    return marks[-1][1]


def d_effort(t: float, dt: float = 0.2) -> float:
    return (effort_at(t) - effort_at(max(0, t - dt))) / dt


def smoothstep(e0: float, e1: float, x: float) -> float:
    if e1 <= e0:
        return 1.0 if x >= e0 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def gated(gate, speed, decel: bool) -> float:
    in_k, full, mx, strip = gate
    g = mx * (1.0 if decel and False else smoothstep(in_k, full, speed))
    if decel and strip:
        g *= 0.22
    return g


def decode(path: Path) -> np.ndarray:
    raw = Path("/tmp") / f"rumoso-dec-{path.stem}.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(raw)],
        check=True,
    )
    x, sr = sf.read(str(raw), always_2d=False)
    if sr != SR:
        raise SystemExit(f"unexpected sr {sr} for {path}")
    if x.ndim > 1:
        x = x.mean(axis=1)
    return x.astype(np.float64)


def loop_to(x: np.ndarray, n: int) -> np.ndarray:
    if len(x) >= n:
        return x[:n].copy()
    reps = int(math.ceil(n / len(x)))
    return np.tile(x, reps)[:n]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    n = int(round(DURATION * SR))
    mix = np.zeros(n, dtype=np.float64)
    hop = int(SR * 0.05)  # 50 ms gain updates
    for file, gate in GATES.items():
        path = STEM_DIR / file
        if not path.exists():
            print("missing stem", path, file=sys.stderr)
            continue
        stem = loop_to(decode(path), n)
        env = np.zeros(n)
        for i in range(0, n, hop):
            t = i / SR
            e = effort_at(t)
            de = d_effort(t)
            speed = e * 1.3
            decel = de <= -8
            env[i : i + hop] = gated(gate, speed, decel)
        # smooth envelope
        tau = int(0.32 * SR)
        if tau > 1:
            k = np.exp(-1.0 / tau)
            acc = env[0]
            sm = np.empty_like(env)
            for i, v in enumerate(env):
                acc = acc * k + v * (1 - k)
                sm[i] = acc
            env = sm
        peak = np.max(np.abs(stem)) + 1e-12
        mix += (stem / peak) * env * 0.22

    # Duck and overlay voices
    for t0, name in VOICES:
        vpath = VOICE_DIR / name
        if not vpath.exists():
            print("missing voice", vpath, file=sys.stderr)
            continue
        voice = decode(vpath)
        start = int(t0 * SR)
        end = min(n, start + len(voice))
        if start >= n:
            continue
        v = voice[: end - start]
        # duck music
        attack = int(0.15 * SR)
        release = int(0.4 * SR)
        tail = int(0.2 * SR)
        duck_end = min(n, end + tail)
        a0 = max(0, start)
        a1 = min(n, start + attack)
        if a1 > a0:
            ramp = np.linspace(1.0, 0.22, a1 - a0)
            mix[a0:a1] *= ramp
        if duck_end > a1:
            hold_end = min(duck_end, end + tail)
            mix[a1:hold_end] *= 0.22
            r0 = hold_end
            r1 = min(n, hold_end + release)
            if r1 > r0:
                mix[r0:r1] *= np.linspace(0.22, 1.0, r1 - r0)
        peak = np.max(np.abs(v)) + 1e-12
        mix[start:end] += (v / peak) * 0.55

    peak = np.max(np.abs(mix)) + 1e-12
    mix = mix / peak * 0.89
    out = OUT_DIR / "rumoso-demo-walk-jog-push-cooldown.wav"
    sf.write(str(out), mix, SR, subtype="PCM_16")
    print(out, "duration", DURATION, "s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
