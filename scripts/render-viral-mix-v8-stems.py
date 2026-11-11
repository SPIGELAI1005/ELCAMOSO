#!/usr/bin/env python3
"""Render v8 Viral Mix overlays: acoustic piano + epic SATB choir.

Uses the same FluidR3_GM (MIT) music-v1 piano and choir sprites that
Midnight Boost's darkrave genre plays through AdaptiveMusicSynth.
Arrangements are original (C# minor, 120 BPM, 4-bar / 8.000 s loops).
Does not modify Midnight Boost, the music-v1 bank, or v6/v7 stems.
"""
from __future__ import annotations

import json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt, resample_poly

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
EIGHTH = BEAT / 2
LOOP = 8.0
N = int(round(LOOP * SR))
XF = int(round(BEAT * SR))
PREROLL = XF

PACK = Path("/workspace/ELCAMOSO-viral-mix/public/audio/symphony/symphony-viral-mix")
BANK = Path("/workspace/ELCAMOSO-viral-mix/public/sample-packs/recorded/music-v1")
RAW = Path("/tmp/viral-mix-v8")

# Sprite metadata from sample-bank-data.ts (FluidR3_GM, MIT).
PIANO_NOTES = [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84]
PIANO_SLOT = 2.6
PIANO_LEAD = 0.05
CHOIR_NOTES = [45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78]
CHOIR_SLOT = 3.2
CHOIR_LEAD = 0.05

# Accordion hook (v6): bars 1–2 ask, bars 3–4 vamp; answer melody speaks on 3–4.
ACC_ASK = [
    61, 64, 66, 64, 61, 59, 61, 63,
    64, 66, 68, 66, 64, 63, 61, 59,
]
ANSWER = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    68, 0, 71, 0, 69, 0, 68, 66,
    66, 64, 63, 0, 61, 0, 61, 0,
]
# Bed harmony i i VI III; melodic section i VI III VII.
BED_CHORDS = [
    (49, 52, 56, 61),  # C#m
    (49, 52, 56, 61),
    (45, 52, 57, 61),  # A
    (52, 59, 64, 68),  # E
]
MEL_CHORDS = [
    (49, 52, 56, 61),  # C#m
    (45, 52, 57, 61),  # A
    (52, 59, 64, 68),  # E
    (47, 51, 54, 59),  # B
]


def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def db(x: float) -> float:
    return 20.0 * math.log10(max(x, 1e-12))


def peak_rms(x: np.ndarray) -> tuple[float, float]:
    mono = x.mean(axis=1) if x.ndim == 2 else x
    return db(float(np.max(np.abs(x)))), db(float(np.sqrt(np.mean(mono * mono))))


def normalize(x: np.ndarray, peak_db: float = -6.0) -> np.ndarray:
    t = 10.0 ** (peak_db / 20.0)
    m = np.max(np.abs(x))
    return x if m < 1e-12 else x * (t / m)


def stereo(x: np.ndarray, width: float = 0.0, pan: float = 0.0) -> np.ndarray:
    if x.ndim == 2:
        y = x.astype(np.float64)
    else:
        y = np.stack([x, x], axis=1).astype(np.float64)
        if width:
            delay = int(0.0008 * SR * width)
            if delay > 0:
                r = np.zeros_like(y[:, 1])
                r[delay:] = y[:-delay, 1]
                y[:, 1] = r
    g_l = math.cos((pan + 1) * math.pi / 4)
    g_r = math.sin((pan + 1) * math.pi / 4)
    y[:, 0] *= g_l
    y[:, 1] *= g_r
    return y


def mix_to(dest: np.ndarray, src: np.ndarray, offset: int, gain: float = 1.0) -> None:
    if src.ndim == 1:
        src = stereo(src)
    if dest.ndim == 1:
        raise ValueError("dest must be stereo")
    start = max(0, offset)
    src_off = start - offset
    n = min(len(dest) - start, len(src) - src_off)
    if n > 0:
        dest[start : start + n] += src[src_off : src_off + n] * gain


def sos_filter(x: np.ndarray, kind: str, cutoff, order: int = 4) -> np.ndarray:
    sos = butter(order, cutoff, btype="lowpass" if kind == "low" else "highpass", fs=SR, output="sos")
    if x.ndim == 2:
        return np.stack([sosfilt(sos, x[:, 0]), sosfilt(sos, x[:, 1])], axis=1)
    return sosfilt(sos, x)


def make_ir(rng: np.random.Generator, seconds: float = 2.8) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    early_t = np.array([0.018, 0.027, 0.041, 0.056, 0.073, 0.098, 0.124, 0.16, 0.21, 0.27])
    early_g = np.array([0.95, 0.72, 0.66, 0.52, 0.42, 0.34, 0.26, 0.2, 0.15, 0.11])
    ir_l = np.zeros(n)
    ir_r = np.zeros(n)
    for ti, g in zip(early_t, early_g):
        i = int(ti * SR)
        if i < n:
            ir_l[i] += g * (0.8 + 0.4 * rng.random())
            j = min(n - 1, i + int((rng.random() - 0.5) * 0.005 * SR))
            ir_r[j] += g * (0.8 + 0.4 * rng.random())
    tau = seconds * 0.38
    tail = rng.standard_normal(n) * np.exp(-t / tau)
    tail = sos_filter(tail, "low", 6200, order=2)
    tail_r = rng.standard_normal(n) * np.exp(-t / (tau * 1.08))
    tail_r = sos_filter(tail_r, "low", 5800, order=2)
    ir_l += 0.42 * tail
    ir_r += 0.42 * tail_r
    ir = np.stack([ir_l, ir_r], axis=1)
    return ir / (np.max(np.abs(ir)) + 1e-12)


def reverb(x: np.ndarray, ir: np.ndarray, send: float = 0.35, dry: float = 1.0, keep_tail: bool = True) -> np.ndarray:
    src = stereo(x) if x.ndim == 1 else x
    wet_l = fftconvolve(src[:, 0], ir[:, 0], mode="full")
    wet_r = fftconvolve(src[:, 1], ir[:, 1], mode="full")
    wet = np.stack([wet_l, wet_r], axis=1)
    out = np.zeros_like(wet)
    out[: len(src)] += dry * src
    out += send * wet
    return out if keep_tail else out[: len(src)]


def loopize(preroll_plus: np.ndarray) -> np.ndarray:
    preroll = preroll_plus[:PREROLL]
    loop = preroll_plus[PREROLL : PREROLL + N].copy()
    tail = preroll_plus[PREROLL + N :]
    if len(tail):
        n = min(len(tail), len(loop))
        loop[:n] += tail[:n]
    t = np.linspace(0.0, 1.0, PREROLL, endpoint=False)
    fade_out = np.cos(t * math.pi / 2)
    fade_in = np.sin(t * math.pi / 2)
    loop[-PREROLL:] = loop[-PREROLL:] * fade_out[:, None] + preroll * fade_in[:, None]
    return loop


def decode_m4a(path: Path) -> tuple[np.ndarray, int]:
    raw = Path(tempfile.mkstemp(suffix=".wav")[1])
    try:
        subprocess.check_call(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(path), str(raw)]
        )
        x, sr = sf.read(str(raw), always_2d=True)
        return x.astype(np.float64), int(sr)
    finally:
        raw.unlink(missing_ok=True)


def to_stereo(x: np.ndarray) -> np.ndarray:
    if x.ndim == 1:
        return np.stack([x, x], axis=1)
    if x.shape[1] == 1:
        return np.concatenate([x, x], axis=1)
    return x


def to_48k(x: np.ndarray, sr: int) -> np.ndarray:
    x = to_stereo(x)
    if sr == SR:
        return x
    g = math.gcd(sr, SR)
    up, down = SR // g, sr // g
    return np.stack([resample_poly(x[:, 0], up, down), resample_poly(x[:, 1], up, down)], axis=1)


def extract_slots(wav: np.ndarray, notes: list[int], slot: float, lead: float) -> dict[int, np.ndarray]:
    out: dict[int, np.ndarray] = {}
    slot_n = int(round(slot * SR))
    lead_n = int(round(lead * SR))
    for i, midi in enumerate(notes):
        start = i * slot_n + lead_n
        end = min(len(wav), (i + 1) * slot_n)
        if end <= start:
            continue
        out[midi] = wav[start:end].copy()
    return out


def nearest(notes: list[int], midi: int) -> int:
    return min(notes, key=lambda n: abs(n - midi))


def pitch_shift(buf: np.ndarray, semis: float) -> np.ndarray:
    if abs(semis) < 1e-6:
        return buf.copy()
    ratio = 2.0 ** (semis / 12.0)
    # resample: higher pitch => fewer samples
    up, down = 1000, max(1, int(round(1000 / ratio)))
    # better: use exact fraction
    # target_len = len / ratio
    from math import gcd

    # ratio = out_sr_equiv; playbackRate = ratio means we want len/ratio samples
    # resample_poly(x, up, down) output length ~= len * up / down
    # want up/down = 1/ratio
    a, b = 1000, int(round(1000 * ratio))
    g = gcd(a, b)
    a, b = a // g, b // g
    y = np.stack([resample_poly(buf[:, 0], a, b), resample_poly(buf[:, 1], a, b)], axis=1)
    return y


def env_gate(n: int, attack: float, release: float, hold: float | None = None) -> np.ndarray:
    att = max(1, int(attack * SR))
    rel = max(1, int(release * SR))
    e = np.ones(n)
    e[:att] = np.linspace(0, 1, att, endpoint=False)
    if hold is not None:
        h = min(n, max(att, int(hold * SR)))
        # everything after h is release
        rel = max(1, n - h)
        e[h:] = np.linspace(1, 0, n - h, endpoint=True)
    else:
        e[-rel:] = np.linspace(1, 0, rel, endpoint=True)
    return e


def play_sprite(
    slots: dict[int, np.ndarray],
    notes: list[int],
    midi: int,
    dur: float,
    vel: float,
    pan: float = 0.0,
    release: float = 0.18,
) -> np.ndarray:
    src_note = nearest(notes, midi)
    buf = slots.get(src_note)
    if buf is None or vel <= 0:
        return np.zeros((max(1, int(dur * SR)), 2))
    shifted = pitch_shift(buf, midi - src_note)
    n = int(round((dur + release) * SR))
    out = np.zeros((n, 2))
    take = min(len(shifted), n)
    out[:take] = shifted[:take]
    e = env_gate(n, attack=0.004, release=release, hold=dur)
    out *= vel * e[:, None]
    return stereo(out, pan=pan)


# Light formant SATB (same vowel centers as viral-vocals.ts) to thicken the GM choir.
FORMANTS = {
    "aah": [(730, 7), (1090, 9), (2440, 12)],
    "ooh": [(400, 8), (800, 10), (2300, 12)],
}


def bandpass_filt(x: np.ndarray, freq: float, q: float) -> np.ndarray:
    # biquad bandpass along time
    w = 2 * math.pi * freq / SR
    alpha = math.sin(w) / (2 * q)
    a0 = 1 + alpha
    b0, b1, b2 = alpha / a0, 0.0, -alpha / a0
    a1, a2 = (-2 * math.cos(w)) / a0, (1 - alpha) / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xi in enumerate(x):
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xi
        y2, y1 = y1, yi
        y[i] = yi
    return y


def formant_voice(midi: int, dur: float, vowel: str, rng: np.random.Generator, pan: float) -> np.ndarray:
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    f0 = midi_hz(midi)
    dets = [-14, -7, 0, 8, 15]
    acc = np.zeros(n)
    form = FORMANTS[vowel]
    for cents in dets:
        hz = f0 * (2.0 ** (cents / 1200.0))
        vib = 1 + 0.005 * np.sin(2 * math.pi * (4.8 + 0.3 * rng.random()) * t)
        phase = np.cumsum(hz * vib / SR)
        glot = (2 * np.mod(phase, 1.0) - 1.0) * 0.7
        glot += (2 * np.mod(phase * 2.01, 1.0) - 1.0) * 0.08
        s = np.zeros(n)
        for freq, q in form:
            s += bandpass_filt(glot, freq, q)
        acc += s
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.25)
    env = np.maximum(env, 0)
    mono = acc * env
    peak = np.max(np.abs(mono)) + 1e-12
    mono = mono / peak * 0.7
    return stereo(mono, width=0.15, pan=pan)


def decode_bank() -> tuple[dict[int, np.ndarray], dict[int, np.ndarray]]:
    piano, psr = decode_m4a(BANK / "piano.m4a")
    choir, csr = decode_m4a(BANK / "choir.m4a")
    piano = to_48k(piano, psr)
    choir = to_48k(choir, csr)
    return (
        extract_slots(piano, PIANO_NOTES, PIANO_SLOT, PIANO_LEAD),
        extract_slots(choir, CHOIR_NOTES, CHOIR_SLOT, CHOIR_LEAD),
    )


def build_piano(
    slots: dict[int, np.ndarray],
    chords: list[tuple[int, ...]],
    answer_bars: bool,
    room_ir: np.ndarray,
) -> np.ndarray:
    total = PREROLL + N + int(2.2 * SR)
    buf = np.zeros((total, 2))
    zero = PREROLL

    def put(midi, start, dur, vel, pan=0.0, release=0.22):
        note = play_sprite(slots, PIANO_NOTES, midi, dur, vel, pan=pan, release=release)
        mix_to(buf, note, zero + int(round(start * SR)), 1.0)

    # Left hand: half-note chords, softer than the melody.
    for bar, chord in enumerate(chords):
        t0 = bar * BAR
        for k, beat_off in enumerate((0.0, 2 * BEAT)):
            # slight roll
            for i, m in enumerate(chord):
                put(m, t0 + beat_off + i * 0.02, BEAT * 1.85, 0.32 + 0.04 * i, pan=-0.22, release=0.35)

    # Right hand: double the accordion ask (bars 1–2); answer it (bars 3–4).
    melody = ACC_ASK + (ANSWER[16:] if answer_bars else ACC_ASK)
    # If not using answer, still play a quieter octave doubling of a simplified vamp? Use answer for bed.
    if len(melody) < 32:
        melody = (ACC_ASK + ANSWER[16:])[:32]
    for i, m in enumerate(melody):
        if m <= 0:
            continue
        start = i * EIGHTH
        # hold through adjacent same-pitch 8ths a little
        run = 1
        while i + run < 32 and melody[i + run] == 0 and (i % 2 == 0):
            run += 1
            break
        dur = EIGHTH * 0.92
        vel = 0.72 if i < 16 else 0.78
        put(m, start, dur, vel, pan=0.12, release=0.2)
        # gentle octave sparkle on longer tones
        if i % 4 == 0:
            put(m + 12, start, dur * 0.7, vel * 0.22, pan=0.28, release=0.16)

    # preroll: last beat of the loop for seamless wrap
    for i, m in enumerate(melody[-4:]):
        if m <= 0:
            continue
        put(m, -BEAT + i * EIGHTH, EIGHTH * 0.92, 0.7, pan=0.12, release=0.2)
    for i, m in enumerate(chords[-1]):
        put(m, -BEAT + i * 0.02, BEAT * 0.95, 0.3, pan=-0.22, release=0.3)

    wet = reverb(buf, room_ir, send=0.28, dry=1.0, keep_tail=True)
    return loopize(wet)


def satb_for_chord(chord: tuple[int, ...]) -> dict[str, int]:
    # Approximate SATB from the chord tones.
    root, third, fifth = chord[0], chord[1], chord[2]
    return {
        "B": root if root >= 45 else root + 12,          # around C#2–E2
        "T": fifth if fifth >= 52 else fifth + 12,       # G#–B
        "A": (third + 12) if third < 60 else third,      # E–G#
        "S": (fifth + 12) if fifth < 68 else fifth,      # G#–E5 area
    }


def hook_soprano() -> list[tuple[float, int, float]]:
    """Half-note hook outline that follows the accordion ask / answer."""
    # (start, midi, dur)
    return [
        (0.0, 61, BEAT), (BEAT, 66, BEAT), (2 * BEAT, 61, BEAT), (3 * BEAT, 63, BEAT),
        (BAR, 64, BEAT), (BAR + BEAT, 68, BEAT), (BAR + 2 * BEAT, 64, BEAT), (BAR + 3 * BEAT, 59, BEAT),
        (2 * BAR, 68, 2 * BEAT), (2 * BAR + 2 * BEAT, 69, BEAT), (2 * BAR + 3 * BEAT, 68, BEAT),
        (3 * BAR, 66, 2 * BEAT), (3 * BAR + 2 * BEAT, 61, 2 * BEAT),
    ]


def build_choir(
    slots: dict[int, np.ndarray],
    chords: list[tuple[int, ...]],
    vowel_pat: list[str],
    hall_ir: np.ndarray,
    rng: np.random.Generator,
    chant_hook: bool,
) -> np.ndarray:
    total = PREROLL + N + int(3.4 * SR)
    buf = np.zeros((total, 2))
    zero = PREROLL
    pans = {"B": -0.35, "T": -0.12, "A": 0.16, "S": 0.38}
    vels = {"B": 0.7, "T": 0.68, "A": 0.72, "S": 0.8}

    def put_choir(midi, start, dur, vel, pan, vowel):
        # FluidR3 choir (Midnight Boost sample)
        note = play_sprite(slots, CHOIR_NOTES, midi, dur, vel, pan=pan, release=0.35)
        # formant thickener
        form = formant_voice(midi, dur + 0.3, vowel, rng, pan=pan)
        mix_to(buf, note, zero + int(round(start * SR)), 1.0)
        mix_to(buf, form, zero + int(round(start * SR)), 0.28)

    for bar, chord in enumerate(chords):
        t0 = bar * BAR
        vowel = vowel_pat[bar]
        parts = satb_for_chord(chord)
        # whole-bar swell for ATB; soprano may chant the hook
        for part, midi in parts.items():
            if part == "S" and chant_hook:
                continue
            put_choir(midi, t0, BAR * 0.98, vels[part], pans[part], vowel)
            # octave double on bass and soprano for density
            if part == "B":
                put_choir(midi + 12, t0, BAR * 0.98, vels[part] * 0.4, pans[part] * 0.7, vowel)
            if part == "A":
                put_choir(midi - 12, t0, BAR * 0.98, vels[part] * 0.3, pans[part] * 0.5, vowel)

    if chant_hook:
        for start, midi, dur in hook_soprano():
            put_choir(midi, start, dur * 0.96, 0.85, 0.4, "aah" if start < 8 else "ooh")
            put_choir(midi - 12, start, dur * 0.96, 0.45, 0.15, "aah" if start < 8 else "ooh")

    # preroll last bar
    chord = chords[-1]
    vowel = vowel_pat[-1]
    parts = satb_for_chord(chord)
    for part, midi in parts.items():
        put_choir(midi, -BAR, BAR * 0.98, vels[part] * 0.85, pans[part], vowel)

    wet = reverb(buf, hall_ir, send=0.55, dry=0.85, keep_tail=True)
    return loopize(wet)


def encode(wav: np.ndarray, dest_base: Path) -> dict:
    raw = RAW / (dest_base.name + ".wav")
    RAW.mkdir(parents=True, exist_ok=True)
    sf.write(str(raw), wav, SR, subtype="PCM_16")
    for out, codec in (
        (dest_base.with_suffix(".m4a"), ["-c:a", "aac", "-b:a", "160k"]),
        (dest_base.with_suffix(".mp3"), ["-c:a", "libmp3lame", "-b:a", "160k"]),
    ):
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw), "-ar", "48000", "-ac", "2", *codec, str(out)],
            check=True,
        )
    p, r = peak_rms(wav)
    return {"file": dest_base.name, "peakDb": round(p, 2), "rmsDb": round(r, 2), "duration": len(wav) / SR}


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(0x56495238)
    room_ir = make_ir(rng, seconds=2.0)
    hall_ir = make_ir(rng, seconds=3.2)
    piano_slots, choir_slots = decode_bank()
    print("piano slots", {k: v.shape for k, v in list(piano_slots.items())[:3]}, "n=", len(piano_slots))
    print("choir slots", {k: v.shape for k, v in list(choir_slots.items())[:3]}, "n=", len(choir_slots))

    stems = {
        "acoustic-piano": normalize(
            build_piano(piano_slots, BED_CHORDS, answer_bars=True, room_ir=room_ir), -8.0
        ),
        "acoustic-piano-melodic": normalize(
            build_piano(piano_slots, MEL_CHORDS, answer_bars=True, room_ir=room_ir), -8.0
        ),
        "choir": normalize(
            build_choir(choir_slots, BED_CHORDS, ["aah", "aah", "aah", "ooh"], hall_ir, rng, True),
            -7.0,
        ),
        "choir-melodic": normalize(
            build_choir(choir_slots, MEL_CHORDS, ["aah", "aah", "ooh", "ooh"], hall_ir, rng, True),
            -7.0,
        ),
    }
    metrics = {}
    for name, wav in stems.items():
        metrics[name] = encode(wav, PACK / f"loop-{name}")
        print(f"loop-{name}", metrics[name], "clip", bool(np.max(np.abs(wav)) >= 0.999))
    (RAW / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")


if __name__ == "__main__":
    main()
