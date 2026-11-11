#!/usr/bin/env python3
"""Render v7 overlay loops: fuller EDM kit + Guetta-style melodic section.

4-bar / 8.000 s / 48 kHz / 120 BPM / C# minor. Does not replace v6 stems.
"""
from __future__ import annotations

import json, math, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt, lfilter

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
LOOP = 8.0
N = int(round(LOOP * SR))
XF = int(round(BEAT * SR))
PREROLL = XF
PACK = Path("/workspace/ELCAMOSO-viral-mix/public/audio/symphony/symphony-viral-mix")
RAW = Path("/tmp/viral-mix-v7")
# C#m A E B  (i VI III VII)
CHORDS = [
    (49, 52, 56, 61),  # C#2 E2 G#2 C#3
    (45, 52, 57, 61),  # A1 E2 A2 C#3
    (52, 59, 64, 68),  # E2 B2 E3 G#3
    (47, 51, 54, 59),  # B1 D#2 F#2 B2
]


def midi_hz(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def db(x):
    return 20.0 * math.log10(max(x, 1e-12))


def peak_rms(x):
    mono = x.mean(axis=1) if x.ndim == 2 else x
    return db(float(np.max(np.abs(x)))), db(float(np.sqrt(np.mean(mono * mono))))


def normalize(x, peak_db=-6.0):
    t = 10.0 ** (peak_db / 20.0)
    m = np.max(np.abs(x))
    return x if m < 1e-12 else x * (t / m)


def stereo(x, width=0.0, pan=0.0):
    if x.ndim == 2:
        return x
    if width:
        d = max(1, int(0.0007 * SR * (0.5 + width)))
        r = np.zeros_like(x)
        r[d:] = x[:-d]
        l, rr = x, r
    else:
        l = rr = x
    a = (pan + 1) * 0.5
    return np.stack([l * math.cos(a * math.pi / 2), rr * math.sin(a * math.pi / 2)], axis=1)


def mix_to(dest, src, at, gain=1.0):
    if src.ndim == 1 and dest.ndim == 2:
        src = stereo(src)
    if src.ndim == 2 and dest.ndim == 1:
        src = src.mean(axis=1)
    if at < 0:
        src = src[-at:]
        at = 0
    n = min(len(src), len(dest) - at)
    if n <= 0:
        return
    dest[at : at + n] += src[:n] * gain


def adsr(n, a, d, s, r):
    ea, ed, er = int(a * SR), int(d * SR), int(r * SR)
    es = max(0, n - ea - ed - er)
    env = np.zeros(n)
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


def saw(t, f):
    return 2.0 * np.mod(t * f, 1.0) - 1.0


def sos_filter(x, kind, cutoff, order=4):
    if kind in {"low", "high"}:
        sos = butter(order, cutoff, btype="lowpass" if kind == "low" else "highpass", fs=SR, output="sos")
    else:
        sos = butter(order, cutoff, btype="bandpass", fs=SR, output="sos")
    if x.ndim == 2:
        return np.stack([sosfilt(sos, x[:, 0]), sosfilt(sos, x[:, 1])], axis=1)
    return sosfilt(sos, x)


def pink(n, rng):
    x = rng.standard_normal(n)
    y = lfilter([0.049922035, -0.095993537, 0.050612699, -0.004408786],
                [1, -2.494956002, 2.017265875, -0.522189400], x)
    return y / (np.max(np.abs(y)) + 1e-12)


def make_ir(rng, seconds=1.8):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir_l = np.zeros(n)
    ir_r = np.zeros(n)
    for ti, g in zip([0.016, 0.027, 0.041, 0.058, 0.09], [0.85, 0.6, 0.5, 0.35, 0.22]):
        i = int(ti * SR)
        ir_l[i] += g
        ir_r[min(n - 1, i + 8)] += g * 0.9
    ir_l += 0.3 * sos_filter(rng.standard_normal(n) * np.exp(-t / 0.45), "low", 6000, 2)
    ir_r += 0.3 * sos_filter(rng.standard_normal(n) * np.exp(-t / 0.5), "low", 5500, 2)
    ir = np.stack([ir_l, ir_r], axis=1)
    return ir / (np.max(np.abs(ir)) + 1e-12)


IR = None


def reverb(x, send=0.3, dry=1.0):
    src = stereo(x) if x.ndim == 1 else x
    wet = np.stack([
        fftconvolve(src[:, 0], IR[:, 0], mode="full"),
        fftconvolve(src[:, 1], IR[:, 1], mode="full"),
    ], axis=1)
    out = np.zeros_like(wet)
    out[: len(src)] += dry * src
    out += send * wet
    return out


def loopize(wet):
    preroll = wet[:PREROLL]
    loop = wet[PREROLL : PREROLL + N].copy()
    tail = wet[PREROLL + N :]
    if len(tail):
        n = min(len(tail), len(loop))
        loop[:n] += tail[:n]
    t = np.linspace(0.0, 1.0, PREROLL, endpoint=False)
    fo, fi = np.cos(t * math.pi / 2), np.sin(t * math.pi / 2)
    if loop.ndim == 2:
        loop[-PREROLL:] = loop[-PREROLL:] * fo[:, None] + preroll * fi[:, None]
    else:
        loop[-PREROLL:] = loop[-PREROLL:] * fo + preroll * fi
    return loop


def span():
    return np.zeros((PREROLL + N + int(2.0 * SR), 2)), PREROLL


def edm_kick(n, rng):
    t = np.arange(n) / SR
    f = 170 * np.exp(-t * 22) + 42
    body = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 6.2)
    click = sos_filter(rng.standard_normal(n), "high", 2500, 2) * np.exp(-t * 90) * 0.4
    return body + click


def snare(n, rng):
    t = np.arange(n) / SR
    tone = np.sin(2 * math.pi * 190 * t) * np.exp(-t * 18) * 0.35
    noise = sos_filter(rng.standard_normal(n), "band", (800, 6500), 3) * np.exp(-t * 16)
    return tone + noise


def clap(n, rng):
    t = np.arange(n) / SR
    y = np.zeros(n)
    for d, g in ((0, 1.0), (0.011, 0.7), (0.02, 0.4), (0.032, 0.25)):
        burst = sos_filter(rng.standard_normal(n), "band", (1400, 5000), 3)
        env = np.exp(-np.maximum(0, t - d) * 40)
        env[: int(d * SR)] = 0
        y += g * burst * env
    return y


def hat(n, rng, openhat=False):
    t = np.arange(n) / SR
    y = sos_filter(rng.standard_normal(n), "high", 7000, 3)
    return y * np.exp(-t * (18 if openhat else 75))


def ride(n, rng):
    t = np.arange(n) / SR
    y = sos_filter(rng.standard_normal(n), "band", (4000, 10000), 2)
    return y * np.exp(-t * 8)


def tom(n, freq, rng):
    t = np.arange(n) / SR
    f = freq * np.exp(-t * 6)
    body = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = sos_filter(rng.standard_normal(n), "band", (200, 800), 2) * np.exp(-t * 30) * 0.3
    return body + click


def shaker(n, rng):
    t = np.arange(n) / SR
    return sos_filter(rng.standard_normal(n), "high", 6000, 3) * np.exp(-t * 55)


def build_kit(rng):
    buf, z = span()
    for bar in range(-1, 4):
        t0 = bar * BAR
        for b in range(4):
            mix_to(buf, stereo(edm_kick(int(0.5 * SR), rng), 0.1), z + int((t0 + b * BEAT) * SR), 1.0)
        for b in (1.0, 3.0):
            mix_to(buf, stereo(snare(int(0.4 * SR), rng), 0.35), z + int((t0 + b * BEAT) * SR), 0.7)
            mix_to(buf, stereo(clap(int(0.4 * SR), rng), 0.55), z + int((t0 + b * BEAT) * SR), 0.85)
        for i in range(8):
            t = t0 + i * (BEAT / 2)
            openhat = i % 2 == 1
            mix_to(buf, stereo(hat(int(0.32 * SR), rng, openhat), 0.45, pan=-0.2 + 0.4 * (i % 2)), z + int(t * SR), 0.5 if openhat else 0.35)
            mix_to(buf, stereo(ride(int(0.35 * SR), rng), 0.4, pan=0.25), z + int(t * SR), 0.18)
        for i in range(16):
            mix_to(buf, stereo(shaker(int(0.12 * SR), rng), 0.3), z + int((t0 + i * (BEAT / 4)) * SR), 0.16 if i % 2 == 0 else 0.1)
        # toms as a light mid-bar figure on bars 2 and 4 (0-index 1, 3)
        if bar % 2 == 1:
            mix_to(buf, stereo(tom(int(0.28 * SR), 140, rng), 0.2, pan=-0.3), z + int((t0 + 2.5 * BEAT) * SR), 0.55)
            mix_to(buf, stereo(tom(int(0.28 * SR), 180, rng), 0.2, pan=0.3), z + int((t0 + 3.0 * BEAT) * SR), 0.45)
    return loopize(reverb(buf, send=0.22, dry=1.0))


def piano_note(freq, dur, rng, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (
        0.7 * np.sin(2 * math.pi * freq * t)
        + 0.28 * np.sin(2 * math.pi * freq * 2 * t) * np.exp(-t * 4)
        + 0.1 * np.sin(2 * math.pi * freq * 3 * t) * np.exp(-t * 7)
        + 0.04 * np.sin(2 * math.pi * freq * 4 * t) * np.exp(-t * 10)
    )
    hammer = sos_filter(rng.standard_normal(n), "band", (800, 4000), 2) * np.exp(-t * 50) * 0.08
    y = (y + hammer) * adsr(n, 0.008, 0.18, 0.55, 0.55) * vel
    return y


def build_piano(rng):
    buf, z = span()
    for bar, chord in enumerate(CHORDS):
        # two pulses per bar (half notes), slightly broken chord
        for k, beat in enumerate((0.0, 2.0)):
            for i, m in enumerate(chord):
                delay = i * 0.018
                note = piano_note(midi_hz(m + 12), 2.15, rng, vel=0.85 if i else 1.0)
                mix_to(buf, stereo(note, 0.25, pan=-0.2 + 0.13 * i), z + int((bar * BAR + beat * BEAT + delay) * SR), 0.9)
        # preroll last chord of previous loop = B
    chord = CHORDS[-1]
    for i, m in enumerate(chord):
        mix_to(buf, stereo(piano_note(midi_hz(m + 12), 2.15, rng), 0.25), z + int((-2 * BEAT + i * 0.018) * SR), 0.9)
    return loopize(reverb(buf, send=0.28, dry=1.0))


def pluck(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = 0.65 * saw(t, freq) + 0.35 * np.sin(2 * math.pi * freq * t)
    y = sos_filter(y, "low", 2800, 2)
    return y * adsr(n, 0.002, 0.06, 0.15, 0.08)


def build_arp(rng):
    buf, z = span()
    sixteenth = BEAT / 4
    patterns = [
        [0, 1, 2, 3, 2, 1, 0, 2, 0, 1, 2, 3, 4, 3, 2, 1],
        [0, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 2],
        [0, 1, 2, 3, 2, 3, 4, 3, 2, 1, 0, 2, 3, 2, 1, 0],
        [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3],
    ]
    for bar, chord in enumerate(CHORDS):
        degrees = list(chord) + [chord[0] + 12]
        pat = patterns[bar]
        for i, idx in enumerate(pat):
            m = degrees[idx % len(degrees)]
            mix_to(buf, stereo(pluck(midi_hz(m + 12), 0.22), 0.45, pan=-0.15 + 0.04 * (i % 4)), z + int((bar * BAR + i * sixteenth) * SR), 0.85)
    # preroll last two 16ths of B
    degrees = list(CHORDS[-1]) + [CHORDS[-1][0] + 12]
    for i, idx in enumerate(patterns[-1][-2:]):
        mix_to(buf, stereo(pluck(midi_hz(degrees[idx % len(degrees)] + 12), 0.22), 0.45), z + int((-BEAT / 2 + i * sixteenth) * SR), 0.85)
    return loopize(reverb(buf, send=0.3, dry=1.0))


def supersaw_chord(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    cents = [-11, -6, -2, 0, 2, 6, 11]
    y = np.zeros(n)
    for f in freqs:
        for c in cents:
            y += saw(t, f * (2 ** (c / 1200.0)))
    y /= (len(freqs) * len(cents))
    y = sos_filter(y, "low", 3800, 2)
    return y * adsr(n, 0.04, 0.15, 0.8, 0.4)


def build_pads(rng):
    buf, z = span()
    for bar, chord in enumerate(CHORDS):
        freqs = [midi_hz(m + 12) for m in chord]
        mix_to(buf, stereo(supersaw_chord(freqs, BAR + 0.3), 0.7), z + int(bar * BAR * SR), 1.0)
    freqs = [midi_hz(m + 12) for m in CHORDS[-1]]
    mix_to(buf, stereo(supersaw_chord(freqs, BAR + 0.3), 0.7), z + int(-BAR * SR), 1.0)
    return loopize(reverb(buf, send=0.4, dry=1.0))


# Soaring lead from the accordion cell C# E F# E C# — longer, an octave up, original continuation.
SOAR = [
    # bar C#m (quarters + held)
    (0.0, 73, 0.9), (1.0, 76, 0.9), (2.0, 78, 1.8),
    # bar A
    (4.0, 80, 0.9), (5.0, 78, 0.45), (5.5, 76, 0.45), (6.0, 73, 1.8),
    # bar E
    (8.0, 80, 0.9), (9.0, 83, 0.9), (10.0, 80, 0.9), (11.0, 78, 0.9),
    # bar B, resolve toward C#
    (12.0, 78, 0.9), (13.0, 76, 0.9), (14.0, 75, 0.9), (15.0, 73, 1.0),
]


def lead_tone(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = freq * (1 + 0.006 * np.sin(2 * math.pi * 5.2 * t))
    y = 0.45 * np.sin(2 * math.pi * vib * t) + 0.3 * saw(t, vib) + 0.15 * saw(t, vib * 0.5)
    y = sos_filter(y, "low", 4500, 2)
    return y * adsr(n, 0.03, 0.08, 0.8, 0.2)


def build_soar(rng):
    buf, z = span()
    # times in the list are in 16th-beats? No: first number is eighths? I used bar-relative with 4 bars = 16 beats, so unit is beats.
    for start_beats, midi, dur_beats in SOAR:
        mix_to(buf, stereo(lead_tone(midi_hz(midi), dur_beats * BEAT + 0.05), 0.5), z + int(start_beats * BEAT * SR), 1.0)
    # preroll last note
    mix_to(buf, stereo(lead_tone(midi_hz(73), 1.0 * BEAT), 0.5), z + int((15 * BEAT - LOOP) * SR), 1.0)
    return loopize(reverb(buf, send=0.38, dry=1.0))


def encode(wav, dest_base, loop=True):
    raw = RAW / (dest_base.name + ".wav")
    RAW.mkdir(parents=True, exist_ok=True)
    sf.write(str(raw), wav, SR, subtype="PCM_16")
    br = "160k" if loop else "128k"
    for out, codec in (
        (dest_base.with_suffix(".m4a"), ["-c:a", "aac", "-b:a", br]),
        (dest_base.with_suffix(".mp3"), ["-c:a", "libmp3lame", "-b:a", br]),
    ):
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw), "-ar", "48000", "-ac", "2", *codec, str(out)],
            check=True,
        )
    p, r = peak_rms(wav)
    return {"file": dest_base.name, "peakDb": round(p, 2), "rmsDb": round(r, 2), "duration": len(wav) / SR}


def main():
    global IR
    rng = np.random.default_rng(0x56495237)
    IR = make_ir(rng)
    RAW.mkdir(parents=True, exist_ok=True)
    stems = {
        "kit": normalize(build_kit(rng), -6.0),
        "piano": normalize(build_piano(rng), -9.0),
        "arp": normalize(build_arp(rng), -10.0),
        "pads": normalize(build_pads(rng), -10.0),
        "soar": normalize(build_soar(rng), -9.0),
    }
    metrics = {}
    for name, wav in stems.items():
        fname = "loop-kit" if name == "kit" else f"loop-melodic-{name}"
        metrics[name] = encode(wav, PACK / fname, loop=True)
        print(fname, metrics[name])
    (RAW / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")


if __name__ == "__main__":
    main()
