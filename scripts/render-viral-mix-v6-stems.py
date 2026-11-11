#!/usr/bin/env python3
"""
Render original ELCAMOSO Viral Mix v6 stems: a clean stadium-anthem production.

Tempo 120 BPM, C# minor, 4/4, 4-bar loops (exactly 8.000 s at 48 kHz).
120 BPM (not the 107.666 reference) is chosen so a 4-bar hook is a clean
8-second clip, stomps and call-and-response land on whole beats, and the
grid matches countable dance/anthem practice.

Voices: local Piper TTS (MIT, rhasspy/piper 2023.11.14-2) with free
en_US-ryan-medium (MC), plus lessac/alan/joe for crowd variety.
Pronunciation prompts: "El kah!" and "Moh so!".
Replace loop-chant / oneshot-elca / oneshot-moso with a real recording
(George + friends) for a clear quality upgrade; same 48 kHz / 8 s loop
and short one-shots, similar loudness.

No licensed reference stems are used.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt, resample_poly

try:
    import librosa
except ImportError:  # pragma: no cover
    librosa = None

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS = 4
LOOP = BARS * BAR  # 8.0 s
N = int(round(LOOP * SR))  # 384000
XF = int(round(BEAT * SR))  # 24000
PREROLL = XF

PIPER = Path("/tmp/piper/piper/piper")
PIPER_LIB = Path("/tmp/piper/piper")
VOICES = Path("/tmp/piper-voices")
RAW_DIR = Path("/tmp/viral-mix-v6")
PACK_DIR = Path("/workspace/ELCAMOSO-viral-mix/public/audio/symphony/symphony-viral-mix")
CLIP_DIR = Path("/workspace/viral-ref/v6")
MANIFEST_OUT = RAW_DIR / "stem-metrics.json"

# C# minor: i | i | VI | III  (C#m C#m A E)
ROOTS = [49, 49, 57, 52]  # C#2, C#2, A2, E2  (MIDI)

# Accordion hook (C#3–G#4 range), 8th notes, 4 bars.
# Very simple 5-note cell: C#4 E4 F#4 E4 C#4, stepwise with a minor-third lift.
# Bars 1–2 ask (rise); bars 3–4 vamp lower while the answer melody speaks.
# MIDI 0 = rest.
ACC_ASK = [
    61, 64, 66, 64, 61, 59, 61, 63,  # C# E F# E C# B C# D#
    64, 66, 68, 66, 64, 63, 61, 59,  # E F# G# F# E D# C# B  (question)
]
ACC_VAMP = [
    49, 56, 61, 56, 49, 56, 61, 64,  # low C# ostinato
    52, 59, 64, 59, 52, 56, 59, 61,
]
ACC_EIGHTHS = ACC_ASK + ACC_VAMP

# Higher counter-melody (8ths), enters at 40–50 km/h.
HIGH_MEL = [
    0, 0, 68, 70, 73, 70, 68, 66,  # late entrance, then E5-ish line an 8ve up from hook
    73, 75, 73, 70, 68, 66, 64, 63,
    68, 73, 75, 73, 70, 68, 66, 64,  # answers / continues
    66, 64, 63, 61, 63, 61, 59, 61,
]

# Mid horn/synth answer (bars 3–4 mainly) — Q&A counterpart to the accordion ask.
ANSWER = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    68, 0, 71, 0, 69, 0, 68, 66,  # G# B A G# F#
    66, 64, 63, 0, 61, 0, 61, 0,  # F# E D#  C#   C#  (resolve)
]

# Brass stabs: short hits, new layer at 80–100.
STABS = [
    # bar 1
    (0.0, 56, 0.18), (1.5, 61, 0.16),
    # bar 2
    (2.0, 56, 0.18), (3.5, 63, 0.16),
    # bar 3 (A)
    (4.0, 57, 0.2), (5.0, 61, 0.14), (5.5, 64, 0.16),
    # bar 4 (E)
    (6.0, 52, 0.2), (6.5, 59, 0.12), (7.0, 64, 0.18), (7.5, 68, 0.16),
]

# Supersaw lead: a catchy higher hook, slightly ornamented, 8ths.
LEAD = [
    73, 73, 76, 78, 76, 73, 71, 73,
    76, 78, 80, 78, 76, 75, 73, 71,
    80, 76, 73, 76, 78, 76, 73, 68,
    71, 73, 76, 73, 71, 68, 66, 73,
]


def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def db(x: float) -> float:
    return 20.0 * math.log10(max(x, 1e-12))


def peak_rms(x: np.ndarray) -> tuple[float, float]:
    if x.ndim == 2:
        m = np.max(np.abs(x))
        mono = x.mean(axis=1)
    else:
        m = np.max(np.abs(x))
        mono = x
    return db(float(m)), db(float(np.sqrt(np.mean(mono * mono))))


def normalize(x: np.ndarray, peak_db: float = -6.0) -> np.ndarray:
    target = 10.0 ** (peak_db / 20.0)
    m = np.max(np.abs(x))
    if m < 1e-12:
        return x
    return x * (target / m)


def soft_limit(x: np.ndarray, ceiling_db: float = -0.8) -> np.ndarray:
    ceil = 10.0 ** (ceiling_db / 20.0)
    m = np.max(np.abs(x))
    if m <= ceil:
        return x
    # tanh-style so peaks sit under the ceiling without a hard clip.
    return np.tanh(x * (0.85 / m)) * ceil / math.tanh(0.85)


def stereo(x: np.ndarray, width: float = 0.0, pan: float = 0.0) -> np.ndarray:
    if x.ndim == 2:
        return x
    n = len(x)
    if width:
        delay = max(1, int(0.0008 * SR * (0.4 + width)))
        r = np.zeros_like(x)
        r[delay:] = x[:-delay]
        r[:delay] = x[:delay] * 0.2
        l, rr = x, r
    else:
        l = rr = x
    # constant-power pan, pan in [-1, 1]
    a = (pan + 1) * 0.5
    gl, gr = math.cos(a * math.pi / 2), math.sin(a * math.pi / 2)
    out = np.stack([l * gl, rr * gr], axis=1)
    return out


def mix_to(dest: np.ndarray, src: np.ndarray, at: int, gain: float = 1.0) -> None:
    if src.ndim == 1 and dest.ndim == 2:
        src = stereo(src)
    if src.ndim == 2 and dest.ndim == 1:
        src = src.mean(axis=1)
    n = min(len(src), len(dest) - at)
    if n <= 0 or at >= len(dest):
        return
    if at < 0:
        src = src[-at:]
        n = min(len(src), len(dest))
        at = 0
    dest[at : at + n] += src[:n] * gain


def adsr(n: int, a: float, d: float, s: float, r: float, sr: int = SR) -> np.ndarray:
    ea, ed, er = int(a * sr), int(d * sr), int(r * sr)
    es = max(0, n - ea - ed - er)
    env = np.zeros(n, dtype=np.float64)
    i = 0
    if ea:
        k = min(ea, n)
        env[i : i + k] = np.linspace(0, 1, k, endpoint=False)
        i += k
    if i < n and ed:
        k = min(ed, n - i)
        env[i : i + k] = np.linspace(1, s, k, endpoint=False)
        i += k
    if i < n and es:
        k = min(es, n - i)
        env[i : i + k] = s
        i += k
    if i < n:
        k = n - i
        start = env[i - 1] if i else s
        env[i:] = np.linspace(start, 0, k, endpoint=True)
    return env


def saw(t: np.ndarray, f: np.ndarray | float) -> np.ndarray:
    return 2.0 * np.mod(t * f, 1.0) - 1.0


def pulse(t: np.ndarray, f: np.ndarray | float, width: float = 0.25) -> np.ndarray:
    return np.where(np.mod(t * f, 1.0) < width, 1.0, -1.0)


def tri(t: np.ndarray, f: np.ndarray | float) -> np.ndarray:
    return 2.0 * np.abs(2.0 * np.mod(t * f, 1.0) - 1.0) - 1.0


def sine(t: np.ndarray, f: np.ndarray | float, ph: float = 0.0) -> np.ndarray:
    return np.sin(2 * math.pi * f * t + ph)


def noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n).astype(np.float64)


def pink(n: int, rng: np.random.Generator) -> np.ndarray:
    # Voss-McCartney-ish: filter white with 1/f approximation.
    x = rng.standard_normal(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [
        1,
        -2.494956002,
        2.017265875,
        -0.522189400,
    ]
    # use sos via lfilter-like scipy
    from scipy.signal import lfilter

    y = lfilter(b, a, x)
    y /= np.max(np.abs(y)) + 1e-12
    return y


def sos_filter(x: np.ndarray, kind: str, cutoff, order: int = 4, q=None) -> np.ndarray:
    if kind in {"low", "high"}:
        sos = butter(order, cutoff, btype="lowpass" if kind == "low" else "highpass", fs=SR, output="sos")
    elif kind == "band":
        sos = butter(order, cutoff, btype="bandpass", fs=SR, output="sos")
    else:
        raise ValueError(kind)
    if x.ndim == 2:
        return np.stack([sosfilt(sos, x[:, 0]), sosfilt(sos, x[:, 1])], axis=1)
    return sosfilt(sos, x)


def make_ir(rng: np.random.Generator, seconds: float = 2.2, stereo: bool = True) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    # Early reflections + exponential tail, highs decay faster.
    early_t = np.array([0.018, 0.027, 0.041, 0.056, 0.073, 0.098, 0.124, 0.16])
    early_g = np.array([0.9, 0.7, 0.65, 0.5, 0.4, 0.32, 0.25, 0.18])
    ir_l = np.zeros(n)
    ir_r = np.zeros(n)
    for ti, g in zip(early_t, early_g):
        i = int(ti * SR)
        if i < n:
            ir_l[i] += g * (0.8 + 0.4 * rng.random())
            j = min(n - 1, i + int((rng.random() - 0.5) * 0.004 * SR))
            ir_r[j] += g * (0.8 + 0.4 * rng.random())
    tail = rng.standard_normal(n) * np.exp(-t / 0.55)
    tail = sos_filter(tail, "low", 6500, order=2)
    tail_r = rng.standard_normal(n) * np.exp(-t / 0.62)
    tail_r = sos_filter(tail_r, "low", 6000, order=2)
    ir_l += 0.35 * tail
    ir_r += 0.35 * tail_r
    ir = np.stack([ir_l, ir_r], axis=1) if stereo else ir_l
    m = np.max(np.abs(ir))
    return ir / (m + 1e-12)


IR = None  # filled in main


def reverb(x: np.ndarray, send: float = 0.35, dry: float = 1.0, keep_tail: bool = True) -> np.ndarray:
    global IR
    assert IR is not None
    src = stereo(x) if x.ndim == 1 else x
    wet_l = fftconvolve(src[:, 0], IR[:, 0], mode="full")
    wet_r = fftconvolve(src[:, 1], IR[:, 1], mode="full")
    wet = np.stack([wet_l, wet_r], axis=1)
    out = np.zeros_like(wet)
    out[: len(src)] += dry * src
    out += send * wet
    return out if keep_tail else out[: len(src)]


def loopize(preroll_plus: np.ndarray) -> np.ndarray:
    """preroll + loop + optional reverb tail; wrap the tail onto the downbeat, then equal-power last beat."""
    assert len(preroll_plus) >= PREROLL + N
    preroll = preroll_plus[:PREROLL]
    loop = preroll_plus[PREROLL : PREROLL + N].copy()
    tail = preroll_plus[PREROLL + N :]
    if len(tail):
        n = min(len(tail), len(loop))
        loop[:n] += tail[:n]
    t = np.linspace(0.0, 1.0, PREROLL, endpoint=False)
    fade_out = np.cos(t * math.pi / 2)
    fade_in = np.sin(t * math.pi / 2)
    if loop.ndim == 2:
        loop[-PREROLL:] = loop[-PREROLL:] * fade_out[:, None] + preroll * fade_in[:, None]
    else:
        loop[-PREROLL:] = loop[-PREROLL:] * fade_out + preroll * fade_in
    return loop


def time_index(span: float, start: float = -BEAT) -> tuple[np.ndarray, np.ndarray, int]:
    """Times from start to start+span; returns t, zeros buffer length, offset of t=0."""
    n = int(round(span * SR))
    t0 = start
    t = t0 + np.arange(n) / SR
    zero = int(round(-start * SR)) if start < 0 else 0
    return t, n, zero


# ---------- voices ----------
def run_piper(text: str, model: str, out: Path, length: float, noise: float = 0.667) -> Path:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(PIPER_LIB) + (":" + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else "")
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(PIPER),
        "-m",
        str(VOICES / f"{model}.onnx"),
        "-f",
        str(out),
        "--length_scale",
        str(length),
        "--noise_scale",
        str(noise),
        "--sentence_silence",
        "0.02",
        "-q",
    ]
    subprocess.run(cmd, input=text + "\n", text=True, check=True, env=env)
    return out


def load_mono(path: Path, target_sr: int = SR) -> np.ndarray:
    x, sr = sf.read(str(path), always_2d=False)
    if x.ndim == 2:
        x = x.mean(axis=1)
    x = x.astype(np.float64)
    if sr != target_sr:
        # resample_poly
        g = math.gcd(sr, target_sr)
        x = resample_poly(x, target_sr // g, sr // g)
    x = x / (np.max(np.abs(x)) + 1e-12)
    return x


def megaphone(x: np.ndarray) -> np.ndarray:
    y = sos_filter(x, "band", (800, 3800), order=3)
    y = np.tanh(y * 3.2) * 0.9
    t = np.arange(len(y)) / SR
    y *= 0.92 + 0.08 * np.sin(2 * math.pi * 5.0 * t)
    # slight presence
    high = sos_filter(y, "high", 1800, order=2)
    y = y + 0.25 * high
    return y / (np.max(np.abs(y)) + 1e-12)


def pitch_shift(x: np.ndarray, semis: float) -> np.ndarray:
    if abs(semis) < 1e-6:
        return x
    if librosa is not None:
        return librosa.effects.pitch_shift(x.astype(np.float32), sr=SR, n_steps=semis).astype(np.float64)
    ratio = 2.0 ** (semis / 12.0)
    n_out = int(len(x) / ratio)
    idx = np.linspace(0, len(x) - 1, n_out)
    return np.interp(idx, np.arange(len(x)), x)


# ---------- instruments ----------
def kick(n: int, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    f = 150 * np.exp(-t * 18) + 38
    body = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = sos_filter(rng.standard_normal(n), "high", 2000, 2) * np.exp(-t * 80) * 0.35
    return body + click


def stomp(n: int, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    thud = np.sin(2 * math.pi * 68 * t) * np.exp(-t * 14)
    mid = sos_filter(rng.standard_normal(n), "band", (80, 420), 3) * np.exp(-t * 18)
    return 0.9 * thud + 0.55 * mid


def clap(n: int, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    y = np.zeros(n)
    for d, g in ((0, 1.0), (0.012, 0.7), (0.021, 0.45), (0.034, 0.28)):
        i = int(d * SR)
        burst = sos_filter(rng.standard_normal(n), "band", (1200, 4500), 3)
        env = np.exp(-np.maximum(0, t - d) * 42)
        env[:i] = 0
        y += g * burst * env
    return y


def hat(n: int, rng: np.random.Generator, openhat: bool = False) -> np.ndarray:
    t = np.arange(n) / SR
    y = sos_filter(rng.standard_normal(n), "high", 7500, 3)
    decay = 22 if openhat else 70
    return y * np.exp(-t * decay)


def accordion_tone(freq: float, dur: float, rng: np.random.Generator, amp: float = 1.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    det = 6.5 / 1200
    a = saw(t, freq * (2 ** det))
    b = saw(t, freq * (2 ** -det))
    c = 0.35 * pulse(t, freq, 0.3)
    d = 0.2 * saw(t, freq * 2)  # reed harmonic
    raw = 0.45 * a + 0.45 * b + c + d
    # reed formants
    y = (
        0.55 * sos_filter(raw, "band", (450, 800), 2)
        + 0.7 * sos_filter(raw, "band", (900, 1600), 2)
        + 0.4 * sos_filter(raw, "band", (1800, 2800), 2)
    )
    trem = 1 + 0.07 * np.sin(2 * math.pi * 5.4 * t + rng.random() * 6)
    env = adsr(n, 0.012, 0.05, 0.85, 0.07)
    return y * trem * env * amp


def brass_tone(freq: float, dur: float, stab: bool = False) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    # slight pitch drop at the attack
    f = freq * (1 + 0.03 * np.exp(-t * 40))
    raw = 0.5 * saw(t, f) + 0.3 * saw(t, f * 0.999) + 0.2 * pulse(t, f, 0.4)
    y = sos_filter(raw, "band", (400, 3200), 2)
    if stab:
        env = adsr(n, 0.006, 0.05, 0.35, 0.08)
    else:
        env = adsr(n, 0.02, 0.08, 0.7, 0.12)
    return y * env


def supersaw(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    cents = [-12, -7, -3, 0, 3, 7, 12]
    y = np.zeros(n)
    for i, c in enumerate(cents):
        y += saw(t, freq * (2 ** (c / 1200.0)) * (1 if i != 3 else 1))
    y /= len(cents)
    y = sos_filter(y, "low", 4200, 2)
    env = adsr(n, 0.01, 0.04, 0.8, 0.08)
    return y * env


def bass_tone(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * math.pi * freq * t)
    click = 0.25 * np.sin(2 * math.pi * freq * 2 * t)
    sub = 0.55 * np.sin(2 * math.pi * (freq / 2) * t)
    y = body + click + sub
    y = sos_filter(y, "low", 280, 3) + 0.15 * np.tanh(sos_filter(y, "low", 600, 2) * 1.5)
    env = adsr(n, 0.006, 0.05, 0.7, 0.06)
    return y * env


def place_eighths(seq, tone_fn, dest, zero, gain=1.0, gate_len=0.42):
    eighth = BEAT / 2
    for i, m in enumerate(seq):
        if not m:
            continue
        start = i * eighth
        at = zero + int(round(start * SR))
        note = tone_fn(midi_hz(m), gate_len + 0.06)
        mix_to(dest, note, at, gain)


def render_span(channels=2):
    n = PREROLL + N + int(2.4 * SR)  # extra tail for reverb, trimmed after loopize
    return np.zeros((n, channels) if channels == 2 else n, dtype=np.float64), PREROLL


# ---------- stem builders ----------
def build_beat(rng):
    buf, zero = render_span()
    # stomp-stomp-clap pattern every bar, plus a solid kick on 1 and 3.
    for bar in range(4):
        t0 = bar * BAR
        # kicks on beats 1 and 3
        for b in (0.0, 2.0):
            mix_to(buf, stereo(kick(int(0.45 * SR), rng), width=0.15), zero + int((t0 + b * BEAT) * SR), 1.0)
        # stomps on 1 and 2
        for b in (0.0, 1.0):
            s = stomp(int(0.4 * SR), rng)
            mix_to(buf, stereo(s, width=0.25, pan=-0.05 + 0.1 * (b)), zero + int((t0 + b * BEAT) * SR), 0.95)
    # preroll = last beat of previous cycle = bar 4 beat 4 is rest, beat 1 of loop is downbeat.
    # Also render one extra bar before 0 (bar 4 repeated as bar -1).
    t0 = -BAR
    for b in (0.0, 2.0):
        mix_to(buf, stereo(kick(int(0.45 * SR), rng), width=0.15), zero + int((t0 + b * BEAT) * SR), 1.0)
    for b in (0.0, 1.0):
        mix_to(buf, stereo(stomp(int(0.4 * SR), rng), width=0.25), zero + int((t0 + b * BEAT) * SR), 0.95)
    wet = reverb(buf, send=0.45, dry=1.0)
    return loopize(wet)


def build_claps(rng):
    buf, zero = render_span()
    for bar in range(-1, 4):
        # clap on beat 3 (the stadium "clap" of stomp-stomp-clap)
        t = bar * BAR + 2 * BEAT
        mix_to(buf, stereo(clap(int(0.5 * SR), rng), width=0.6, pan=0.0), zero + int(t * SR), 1.0)
    wet = reverb(buf, send=0.5, dry=0.95)
    return loopize(wet)


def build_hats(rng):
    buf, zero = render_span()
    eighth = BEAT / 2
    for bar in range(-1, 4):
        for i in range(8):
            t = bar * BAR + i * eighth
            openhat = i % 2 == 1
            vel = 0.55 if i % 2 == 0 else 0.85
            mix_to(
                buf,
                stereo(hat(int((0.28 if not openhat else 0.4) * SR), rng, openhat), width=0.5, pan=-0.15 + 0.3 * (i % 2)),
                zero + int(t * SR),
                vel,
            )
        # extra snare-clap on 2 and 4 at this layer
        for b in (1.0, 3.0):
            mix_to(buf, stereo(clap(int(0.28 * SR), rng), width=0.4), zero + int((bar * BAR + b * BEAT) * SR), 0.45)
    wet = reverb(buf, send=0.28, dry=1.0)
    return loopize(wet)


def build_accordion(rng):
    buf, zero = render_span()
    eighth = BEAT / 2

    def tone(f, d):
        return stereo(accordion_tone(f, d, rng), width=0.35, pan=-0.1)

    # preroll: last 2 eighths of vamp
    for i, m in enumerate(ACC_EIGHTHS):
        start = i * eighth
        mix_to(buf, tone(midi_hz(m), 0.46), zero + int(start * SR), 1.0)
    # preroll notes = last two 8ths of the loop (bar 4)
    for i, m in enumerate(ACC_EIGHTHS[-2:]):
        start = -BEAT + i * eighth
        mix_to(buf, tone(midi_hz(m), 0.46), zero + int(start * SR), 1.0)
    wet = reverb(buf, send=0.32, dry=1.0)
    return loopize(wet)


def build_countermelody(rng):
    buf, zero = render_span()
    eighth = BEAT / 2

    def high(f, d):
        n = int(d * SR)
        t = np.arange(n) / SR
        y = 0.6 * tri(t, f) + 0.4 * saw(t, f * 1.002)
        y = sos_filter(y, "band", (800, 4500), 2)
        y *= adsr(n, 0.01, 0.04, 0.75, 0.09)
        return stereo(y, width=0.45, pan=0.15)

    def answer(f, d):
        return stereo(brass_tone(f, d, stab=False), width=0.3, pan=0.2)

    for i, m in enumerate(HIGH_MEL):
        if m:
            mix_to(buf, high(midi_hz(m), 0.44), zero + int(i * eighth * SR), 0.85)
    for i, m in enumerate(ANSWER):
        if m:
            mix_to(buf, answer(midi_hz(m), 0.48), zero + int(i * eighth * SR), 0.9)
    # preroll: last beat of high line
    for i, m in enumerate(HIGH_MEL[-2:]):
        if m:
            mix_to(buf, high(midi_hz(m), 0.44), zero + int((-BEAT + i * eighth) * SR), 0.85)
    wet = reverb(buf, send=0.4, dry=1.0)
    return loopize(wet)


def build_brass(rng):
    buf, zero = render_span()
    for start, midi, dur in STABS:
        mix_to(buf, stereo(brass_tone(midi_hz(midi), dur, stab=True), width=0.4, pan=0.05), zero + int(start * SR), 1.0)
    # preroll: last stab of previous loop (bar 4, 7.5s)
    mix_to(buf, stereo(brass_tone(midi_hz(68), 0.16, stab=True), width=0.4), zero + int((7.5 - LOOP) * SR), 1.0)
    wet = reverb(buf, send=0.42, dry=1.0)
    return loopize(wet)


def build_lead(rng):
    buf, zero = render_span()
    eighth = BEAT / 2
    for i, m in enumerate(LEAD):
        if m:
            mix_to(buf, stereo(supersaw(midi_hz(m), 0.46), width=0.7, pan=0.0), zero + int(i * eighth * SR), 1.0)
    for i, m in enumerate(LEAD[-2:]):
        mix_to(buf, stereo(supersaw(midi_hz(m), 0.46), width=0.7), zero + int((-BEAT + i * eighth) * SR), 1.0)
    wet = reverb(buf, send=0.3, dry=1.0)
    return loopize(wet)


def build_bass(rng):
    buf, zero = render_span(1)
    # Driving 8ths: root-root-rest-root | fifth, with a pickup.
    pattern = [1, 0, 1, 1, 1, 0, 1, 0]  # per bar, 8ths
    eighth = BEAT / 2
    for bar, root in enumerate(ROOTS):
        for i, on in enumerate(pattern):
            if not on:
                continue
            midi = root if i < 6 else root + (7 if bar < 3 else 5)
            start = bar * BAR + i * eighth
            mix_to(buf, bass_tone(midi_hz(midi), 0.28), zero + int(start * SR), 1.0)
    # preroll last bar pattern beat 4 (bar 4 last two 8ths — last is rest, 2nd last may be on)
    bar, root = 3, ROOTS[3]
    for i, on in enumerate(pattern[-2:]):
        if on:
            midi = root + 5
            mix_to(buf, bass_tone(midi_hz(midi), 0.28), zero + int((-BEAT + i * eighth) * SR), 1.0)
    y = stereo(sos_filter(buf, "low", 220, 3), width=0.05)
    # very short room, keep the low end tight
    wet = reverb(y, send=0.12, dry=1.0)
    return loopize(wet)


def build_arena(rng):
    buf, zero = render_span()
    n = len(buf)
    roar = pink(n, rng)
    roar = sos_filter(roar, "band", (200, 2800), 2)
    # slow swell
    t = np.arange(n) / SR
    env = 0.5 + 0.5 * np.sin(2 * math.pi * t / LOOP)
    roar *= env * 0.25
    # sparse "woo" bursts
    for _ in range(10):
        at = rng.integers(0, n - int(0.4 * SR))
        burst = pink(int(0.5 * SR), rng) * adsr(int(0.5 * SR), 0.04, 0.1, 0.5, 0.25) * 0.2
        burst = sos_filter(burst, "band", (400, 2000), 2)
        mix_to(buf, stereo(burst, width=0.8, pan=rng.uniform(-0.6, 0.6)), int(at), 1.0)
    mix_to(buf, stereo(roar, width=0.9), 0, 1.0)
    wet = reverb(buf, send=0.7, dry=0.6)
    return loopize(wet)


def process_elca(x: np.ndarray) -> np.ndarray:
    y = megaphone(x)
    # slap-back PA
    slap = np.zeros_like(y)
    d = int(0.038 * SR)
    slap[d:] = y[:-d] * 0.45
    y = y + slap
    return y


def build_crowd_shout(takes: list[np.ndarray], rng) -> np.ndarray:
    # Layer many pitch/time-varied copies.
    parts = []
    for src in takes:
        for semis in (-2.0, -1.0, 0.0, 0.7, 1.5, 2.5):
            y = pitch_shift(src, semis + rng.uniform(-0.15, 0.15))
            # tiny time jitter via pad
            pad = int(rng.uniform(0, 0.035) * SR)
            z = np.concatenate([np.zeros(pad), y])
            # slight band variation as a cheap "formant" stand-in
            lo, hi = 600 + rng.uniform(-80, 80), 3400 + rng.uniform(-200, 200)
            z = sos_filter(z, "band", (lo, hi), 2)
            parts.append((z, rng.uniform(-0.7, 0.7), rng.uniform(0.55, 1.0)))
    n = max(len(p) for p, _, _ in parts) + int(0.05 * SR)
    acc = np.zeros((n, 2))
    for z, pan, g in parts:
        mix_to(acc, stereo(z, width=0.3, pan=pan), 0, g)
    acc = np.tanh(acc * 0.7) 
    return acc / (np.max(np.abs(acc)) + 1e-12)


def build_chant(elca_takes, moso_crowd, rng):
    buf, zero = render_span()
    # ElCA on bars 1 and 3 (t=0, 4); MOSO on bars 2 and 4 (t=2, 6)
    def place(sig, t, gain, pan=0.0):
        mix_to(buf, stereo(sig if sig.ndim == 1 else sig, width=0.2, pan=pan), zero + int(t * SR), gain)

    # two slightly different MC takes if available
    elca0 = process_elca(elca_takes[0])
    elca1 = process_elca(elca_takes[min(1, len(elca_takes) - 1)])
    place(elca0, 0.0, 1.0, -0.05)
    place(elca1, 4.0, 1.0, 0.05)
    place(moso_crowd, 2.0, 1.15, 0.0)
    place(moso_crowd, 6.0, 1.2, 0.0)
    wet = reverb(buf, send=0.62, dry=0.85)
    return loopize(wet)


def build_hey_loop(hey_crowd, rng):
    buf, zero = render_span()
    # Hey on the off-bar: bars 2 and 4 beat 1, plus a weaker one on beat 3 of bar 4
    place_times = [2.0, 6.0, 7.0]
    for i, t in enumerate(place_times):
        mix_to(buf, stereo(hey_crowd, width=0.5, pan=0.05 * ((-1) ** i)), zero + int(t * SR), 0.9 if i < 2 else 0.55)
    wet = reverb(buf, send=0.55, dry=0.9)
    return loopize(wet)


def build_riser(rng):
    n = int(2 * BAR * SR)  # 2 bars
    t = np.arange(n) / SR
    noise_s = sos_filter(pink(n, rng), "high", 400, 2)
    # rising HPF
    sweep = np.sin(2 * math.pi * (220 * (2 ** (t / t[-1] * 3))) * t) * 0.15
    env = t / t[-1]
    env = env ** 1.4
    y = (0.7 * noise_s + sweep) * env
    y = stereo(y, width=0.7)
    return reverb(y, send=0.45, dry=1.0)


def build_fill(rng):
    # 8-16th clap run over 2 beats, crash on the downbeat of the next bar, keep reverb tail.
    sixteenth = BEAT / 4
    buf = np.zeros((int(3.5 * SR), 2))
    for i in range(8):
        vel = 0.4 + 0.08 * i
        mix_to(buf, stereo(clap(int(0.2 * SR), rng), width=0.4), int(i * sixteenth * SR), vel)
    crash = sos_filter(pink(int(1.4 * SR), rng), "high", 2000, 2) * adsr(int(1.4 * SR), 0.005, 0.12, 0.4, 0.9)
    mix_to(buf, stereo(crash, width=0.8), int(2 * BEAT * SR), 0.85)
    return reverb(buf, send=0.45, dry=1.0)


def encode(wav: np.ndarray, dest_base: Path, bitrate_loop=True):
    raw = RAW_DIR / (dest_base.name + ".wav")
    sf.write(str(raw), wav, SR, subtype="PCM_16")
    br = "160k" if bitrate_loop else "128k"
    m4a = dest_base.with_suffix(".m4a")
    mp3 = dest_base.with_suffix(".mp3")
    for out, codec in ((m4a, ["-c:a", "aac", "-b:a", br]), (mp3, ["-c:a", "libmp3lame", "-b:a", br])):
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw), "-ar", "48000", "-ac", "2", *codec, str(out)],
            check=True,
        )
    p, r = peak_rms(wav)
    return {"file": dest_base.name, "peakDb": round(p, 2), "rmsDb": round(r, 2), "duration": len(wav) / SR}


def main():
    global IR
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    CLIP_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(0x454C4341)
    IR = make_ir(rng, seconds=2.3)

    print("Synthesizing Piper takes…")
    takes_dir = RAW_DIR / "tts"
    elca_files = []
    for i, length in enumerate((0.95, 1.05, 0.88)):
        p = takes_dir / f"elca_ryan_{i}.wav"
        run_piper("El kah!", "en_US-ryan-medium", p, length=length, noise=0.6 + 0.05 * i)
        elca_files.append(p)
    moso_files = []
    hey_files = []
    for model, length in (
        ("en_US-ryan-medium", 0.72),
        ("en_US-lessac-medium", 0.7),
        ("en_GB-alan-medium", 0.68),
        ("en_US-joe-medium", 0.74),
        ("en_US-lessac-medium", 0.85),
        ("en_US-ryan-medium", 0.62),
    ):
        p = takes_dir / f"moso_{model}_{length}.wav"
        run_piper("Moh so!", model, p, length=length, noise=0.75)
        moso_files.append(p)
        h = takes_dir / f"hey_{model}_{length}.wav"
        run_piper("Hey!", model, h, length=0.65, noise=0.7)
        hey_files.append(h)

    elca_takes = [load_mono(p) for p in elca_files]
    moso_takes = [load_mono(p) for p in moso_files]
    hey_takes = [load_mono(p) for p in hey_files]
    print("Building crowd layers…")
    moso_crowd = build_crowd_shout(moso_takes, rng)
    hey_crowd = build_crowd_shout(hey_takes, rng)

    print("Rendering stems…")
    stems = {}
    stems["beat"] = normalize(build_beat(rng), -6.5)
    stems["claps"] = normalize(build_claps(rng), -7.0)
    stems["hats"] = normalize(build_hats(rng), -8.0)
    stems["accordion"] = normalize(build_accordion(rng), -8.0)
    stems["countermelody"] = normalize(build_countermelody(rng), -9.0)
    stems["brass"] = normalize(build_brass(rng), -8.0)
    stems["lead"] = normalize(build_lead(rng), -8.5)
    stems["bass"] = normalize(build_bass(rng), -7.5)
    stems["arena"] = normalize(build_arena(rng), -16.0)
    stems["chant"] = normalize(build_chant(elca_takes, moso_crowd, rng), -10.0)
    stems["hey"] = normalize(build_hey_loop(hey_crowd, rng), -11.0)

    oneshots = {
        "elca": normalize(reverb(stereo(process_elca(elca_takes[0]), width=0.15), send=0.55, dry=0.9), -8.0),
        "moso": normalize(reverb(moso_crowd, send=0.55, dry=0.9), -7.0),
        "hey-1": normalize(reverb(stereo(hey_takes[0], width=0.3), send=0.4, dry=0.95), -8.0),
        "hey-2": normalize(reverb(stereo(hey_takes[min(1, len(hey_takes) - 1)], width=0.4, pan=-0.2), send=0.4, dry=0.95), -8.0),
        "hey-3": normalize(reverb(stereo(hey_takes[min(2, len(hey_takes) - 1)], width=0.4, pan=0.2), send=0.4, dry=0.95), -8.0),
        "riser": normalize(build_riser(rng), -8.0),
        "fill": normalize(build_fill(rng), -7.0),
    }

    # 8 s sonic-logo clip: beat + claps + accordion + chant (chant a bit forward) + light arena
    clip = stems["beat"] * 0.7 + stems["claps"] * 0.7 + stems["accordion"] * 0.85 + stems["chant"] * 1.15 + stems["arena"] * 0.5
    clip = soft_limit(clip, -1.0)

    print("Encoding…")
    # Remove previous pack assets so we don't ship extracted stems.
    for old in PACK_DIR.glob("*"):
        if old.is_file():
            old.unlink()

    metrics = {"loops": [], "oneshots": [], "clip": None, "bpm": BPM, "key": "C# minor", "loopSeconds": LOOP}
    name_map = {
        "beat": "loop-beat",
        "claps": "loop-claps",
        "hats": "loop-hats",
        "accordion": "loop-accordion",
        "countermelody": "loop-countermelody",
        "brass": "loop-brass",
        "lead": "loop-lead",
        "bass": "loop-bass",
        "arena": "loop-arena",
        "chant": "loop-chant",
        "hey": "loop-hey",
    }
    for key, fname in name_map.items():
        metrics["loops"].append(encode(stems[key], PACK_DIR / fname, bitrate_loop=True))
        print(" ", fname, metrics["loops"][-1])
    for key, wav in oneshots.items():
        metrics["oneshots"].append(encode(wav, PACK_DIR / f"oneshot-{key}", bitrate_loop=False))
        print(" ", f"oneshot-{key}", metrics["oneshots"][-1])

    clip_path = CLIP_DIR / "elca-moso-chant-clip.wav"
    sf.write(str(clip_path), clip, SR, subtype="PCM_16")
    p, r = peak_rms(clip)
    metrics["clip"] = {"file": str(clip_path), "peakDb": round(p, 2), "rmsDb": round(r, 2), "duration": len(clip) / SR}
    print(" clip", metrics["clip"])

    # also leave raw wavs
    MANIFEST_OUT.write_text(json.dumps(metrics, indent=2) + "\n")
    print("metrics", MANIFEST_OUT)
    print("pack dir files", len(list(PACK_DIR.glob('*'))))


if __name__ == "__main__":
    main()
