#!/usr/bin/env python3
"""
Offline renderer for the American Muscle V8 "Coyote v2" loop bank.

Physically based, procedural model of a naturally aspirated 5.0 cross-plane V8
(Ford Coyote style) with the factory active exhaust in Sport mode:

  * firing order 1-5-4-8-6-3-7-2, cylinders 1-4 on the right bank and 5-8 on the
    left bank, one firing every 90 degrees of crank: event rate = RPM / 15 Hz
  * each firing puts an exhaust blowdown pulse into its own bank, so each bank sees an
    uneven R L R L L R L R pulse pattern: that unevenness is the cross-plane burble
  * per-bank pipe resonances + muffler, banks summed through a crossover
  * layers mixed offline: body, growl (soft saturation), rasp (turbulent noise gated
    by each pulse), intake (induction noise at the event rate), light mechanical tick
  * load changes pulse strength, sharpness and rasp; overrun (fuel cut) leaves weak,
    irregular pumping pulses with a hollow tone

Everything time-varying is either per firing event or per sample (saturation), and all
filters are static, so a constant-RPM render can be done on a circular buffer: each loop
holds a whole number of engine cycles and is exactly periodic (seamless loop). Loops are
written with copies of their own tail/head as margins so the loop window stays seamless
even if a decoder shifts the audio by the AAC priming delay.

coyote-v2.3 (cruise growl / continuity / race gearbox):
  * cruise character above idle: unequal-primary pulse offsets, a fixed cylinder spread and
    a softer X-pipe keep the cross-plane burble at steady part throttle (it used to fade
    to an even, bland hum above ~1,500 rpm); the 700 / 950 idle points are unchanged
  * points from 1,250 rpm share one variation sequence and crank-synchronous noise and hold
    whole multiples of 16 cycles, so the runtime can crank-align neighbours: a cruise or
    pull between two grid points is one engine, not two out-of-phase engines
  * on-load band balance rises smoothly with rpm (no 3-8 kHz jump around 3,100 rpm)

coyote-v2.4 (Racing V10 shifts and race overrun):
  * the loops are unchanged (byte-for-byte the same render as v2.3)
  * the modal "struck steel" gearbox one-shots (gear_out, gear_in1/2) and the engine-render
    upshift one-shots (upshift1/2) are gone: shifts now use the Racing V10's procedural
    choreography at runtime (filtered-noise gear engagement + driveline thump + recovery)
  * crackle1-3: the Racing V10's race-mode overrun crackle (a short pressure impulse through
    the V10 pop chain: body low-pass + three pipe modes + soft saturation + high cut), voiced
    with this V8's exhaust modes, for the race-mode lift-off / downshift crackle tail

Output: one mono AAC (.m4a) file with every loop and one-shot, plus a JSON map.
Usage: python3 scripts/sound/coyote_v8_bank.py <out_dir> [--json PATH] [--wav-dir DIR]
  (repo: public/sample-packs/recorded/coyote-v2 --json src/lib/sound/coyote-v8/coyote-v2-bank.json)
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys

import numpy as np

SR = 48000
FIRING_ORDER = [1, 5, 4, 8, 6, 3, 7, 2]
# Ford numbering: 1-4 right (passenger) bank, 5-8 left bank.
BANK_OF = {c: (0 if c <= 4 else 1) for c in range(1, 9)}
RPM_POINTS = [700, 950, 1250, 1650, 2150, 2750, 3450, 4250, 5150, 6100, 7000]
LOADS = ["light", "on", "over"]
MARGIN_S = 0.1  # > AAC priming (2112 samples) + transform spread (2048 samples)
VERSION = "coyote-v2.4"
# New file name per bank version: a cached older bank can never pair with this map.
BANK_FILE = "coyote_v2_4_bank.m4a"
# unequal-primary arrival spread (s, 1 sigma) and how it narrows above 2,000 rpm
MAN_SKEW_S = float(os.environ.get("COYOTE_MAN_SKEW", "0.00025"))
MAN_SKEW_EXP = float(os.environ.get("COYOTE_MAN_EXP", "1.0"))


# ----------------------------------------------------------------------------- helpers

def db(x: float) -> float:
    return 20 * math.log10(max(1e-12, x))


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(x)) + 1e-20))


def freqs(n: int) -> np.ndarray:
    return np.fft.rfftfreq(n, 1 / SR)


def peak_resp(f: np.ndarray, f0: float, q: float, gain_db: float) -> np.ndarray:
    """Magnitude response of a resonant peak (zero phase, symmetric in log f)."""
    g = 10 ** (gain_db / 20) - 1
    x = (f / f0 - f0 / np.maximum(f, 1e-3)) * q
    return 1 + g / (1 + x * x)


def lp_resp(f: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp_resp(f: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    r = (f / fc) ** (2 * order)
    return np.sqrt(r / (1 + r))


def bp_resp(f: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return hp_resp(f, lo, order) * lp_resp(f, hi, order)


def min_phase(mag: np.ndarray, n: int) -> np.ndarray:
    """Minimum-phase spectrum from a magnitude (real cepstrum folding)."""
    full = np.concatenate([mag, mag[-2:0:-1]]) if n % 2 == 0 else np.concatenate([mag, mag[:0:-1]])
    logm = np.log(np.maximum(full, 1e-9))
    cep = np.fft.ifft(logm).real
    w = np.zeros(n)
    w[0] = 1
    w[1:(n + 1) // 2] = 2
    if n % 2 == 0:
        w[n // 2] = 1
    spec = np.exp(np.fft.fft(cep * w))
    return spec[: n // 2 + 1]


def apply(x: np.ndarray, mag: np.ndarray) -> np.ndarray:
    """Circular filtering with a minimum-phase version of mag (causal, physical-like)."""
    n = len(x)
    return np.fft.irfft(np.fft.rfft(x) * min_phase(mag, n), n)


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ----------------------------------------------------------------------------- model

class Exhaust:
    """Static exhaust geometry (Sport mode: active valves open)."""

    def __init__(self, n: int):
        f = freqs(n)
        self.f = f
        c = 520.0  # hot exhaust gas speed of sound (m/s)
        banks = []
        for b, length in enumerate([2.35, 2.2]):
            mag = np.ones_like(f)
            # quarter-wave tailpipe modes (drone / body)
            for k in range(1, 6):
                f0 = (2 * k - 1) * c / (4 * length)
                mag *= peak_resp(f, f0, 2.6 + k * 0.6, 4.5 - k * 0.6)
            # header/collector resonance gives the mid "growl"
            mag *= peak_resp(f, 340 + 25 * b, 1.6, 3.0)
            # active-valve muffler in Sport: fairly open, gentle top roll-off
            mag *= lp_resp(f, 2600, 2) * (0.55 + 0.45 * lp_resp(f, 900, 1))
            banks.append(mag)
        self.bank = banks
        self.radiation = hp_resp(f, 32, 2)  # tailpipe radiation: little real output < 30 Hz
        self.n = n


CRANK_NOISE_RES_DEG = 0.1


def crank_noise(crank: np.ndarray, var_period: int, variant: int) -> np.ndarray:
    """White noise defined on crank angle (0.1 degree grid), periodic over var_period cycles."""
    m = int(round(var_period * 720 / CRANK_NOISE_RES_DEG))
    table = np.random.default_rng(9400 + variant).standard_normal(m)
    pos = (crank - crank[0]) / CRANK_NOISE_RES_DEG
    i = np.floor(pos).astype(np.int64)
    fr = pos - i
    a = table[i % m]
    b = table[(i + 1) % m]
    y = a + (b - a) * fr
    # linear interpolation lowers the level between grid points: restore unit variance
    return y / (np.std(y) + 1e-12)


def engine_render(
    rpm: np.ndarray,
    load: np.ndarray,
    n: int,
    circular: bool,
    seed: int,
    *,
    overrun: np.ndarray | None = None,
    idle_lope: float = 0.0,
    jitter_seed: int | None = None,
    crank: np.ndarray | None = None,
    extra_rasp: np.ndarray | None = None,
    phase0: float = 0.0,
    cruise: float = 0.0,
    var_period: int | None = None,
):
    """
    Render engine audio for per-sample rpm / load (0..1) / overrun (0..1, fuel cut).
    circular=True requires the crank phase to wrap exactly at n (constant rpm loops).
    Returns the mono mix (float64, not normalised) and the event times (samples).

    cruise (0..1) keeps the cross-plane character off idle (bank loops above ~1,000 rpm).
    Without it the per-cylinder variation fades with idle_lope and a steady cruise sums to
    an almost even 90-degree pulse train: smooth, but a bland hum. With it:
      * unequal-length primaries: each cylinder's pulse reaches the collector with its own
        fixed *time* offset (a few tenths of a ms), so the uneven R/L pattern survives at
        every rpm instead of shrinking with the firing interval
      * a fixed cylinder-to-cylinder strength spread and a softer X-pipe crossover, so each
        bank's own uneven pulse train stays audible
      * a bit more growl drive at part load (the burble, not the rasp)
    cruise=0 renders exactly as before (idle loop, startup and one-shots unchanged).

    var_period (engine cycles): draw the cycle-to-cycle variation from one shared sequence
    that repeats every var_period cycles, indexed by firing slot. Loops rendered this way
    (with a whole multiple of var_period cycles) are the same engine performance at every
    rpm point and load, so the runtime can crank-align neighbouring points and crossfade
    them coherently (a timbre morph instead of two engines playing at once).
    """
    rng = np.random.default_rng(seed)
    jrng = np.random.default_rng(seed if jitter_seed is None else jitter_seed)
    if overrun is None:
        overrun = np.zeros(n)
    if extra_rasp is None:
        extra_rasp = np.zeros(n)
    # crank angle in degrees, integrated from rpm (deg/sample = rpm*6/SR)
    if crank is None:
        crank = phase0 + np.cumsum(rpm * 6.0 / SR) - rpm[0] * 6.0 / SR
    total_deg = crank[-1] + rpm[-1] * 6.0 / SR - crank[0]
    first = math.ceil(crank[0] / 90.0)
    last = math.floor((crank[0] + total_deg - 1e-9) / 90.0)
    slots = np.arange(first, last + 1)
    # sample position of each firing slot (fractional)
    idx = np.interp(slots * 90.0, crank, np.arange(n, dtype=np.float64))
    ncyc_slots = len(slots)

    # per-cylinder fixed imbalance (combustion / trapped mass differences)
    trim_rng = np.random.default_rng(1005)
    cyl_trim = 1 + (0.05 + 0.08 * idle_lope) * trim_rng.standard_normal(9)
    # fixed per-cylinder timing offsets (fraction of a firing interval): lumpier at idle
    cyl_skew = (0.006 + 0.03 * idle_lope) * trim_rng.standard_normal(9)
    # unequal primaries (cruise character): fixed per-cylinder arrival offsets in seconds
    man_rng = np.random.default_rng(2024)
    man_skew_s = MAN_SKEW_S * man_rng.standard_normal(9)
    man_trim = 1 + 0.10 * man_rng.standard_normal(9)
    exh = [np.zeros(n), np.zeros(n)]
    gate = np.zeros(n)  # rasp gate (turbulent blowdown)
    ing = np.zeros(n)  # intake suction envelope
    events = []
    shared = None
    if var_period:
        m = var_period * 8
        vr = np.random.default_rng(9300)
        shared = (vr.standard_normal(m), vr.standard_normal(m))
    for j, s in enumerate(slots):
        pos = idx[j]
        i0 = int(pos)
        r = float(rpm[min(n - 1, i0)])
        ld = float(load[min(n - 1, i0)])
        ov = float(overrun[min(n - 1, i0)])
        cyl = FIRING_ORDER[int(s) % 8]
        bank = BANK_OF[cyl]
        interval = SR * 60.0 / (r * 4.0)  # samples between firings
        # cycle-to-cycle variation: larger at idle and in fuel cut
        sig_a = 0.05 + 0.06 * idle_lope + 0.30 * ov + 0.03 * (1 - ld)
        sig_t = (0.004 + 0.008 * idle_lope + 0.02 * ov) * interval
        if shared is not None:
            si = int(s) % len(shared[0])
            z_t, z_a = shared[0][si], shared[1][si]
        else:
            z_t = jrng.standard_normal()
            z_a = None
        jt = sig_t * z_t + cyl_skew[cyl] * interval
        if cruise > 0:
            jt += cruise * man_skew_s[cyl] * SR * (2000.0 / max(r, 2000.0)) ** MAN_SKEW_EXP
        pos_j = pos + jt
        if circular:
            pos_j %= n
        # combustion strength: load sets fuel; overrun has none (pumping only)
        strength = (0.32 + 0.68 * ld) * (1 - 0.86 * ov)
        if z_a is None:
            z_a = rng.standard_normal()
        amp = strength * cyl_trim[cyl] * max(0.15, 1 + sig_a * z_a)
        if cruise > 0:
            amp *= 1 + cruise * (man_trim[cyl] - 1)
        # exhaust gas pressure rises a little with rpm (more mass flow)
        amp *= (r / 2000.0) ** 0.22
        # blowdown pulse width: crank-angle based, clamped to physical time limits
        deg = 34 - 10 * ld + 14 * ov
        tau = np.clip(deg / (6.0 * r) / 2.2, 0.00028, 0.0026) * SR
        width = int(tau * 14) + 8
        k = np.arange(width)
        frac = pos_j - math.floor(pos_j)
        tt = (k - frac) / tau
        tt = np.maximum(tt, 0)
        pulse = tt * tt * np.exp(-tt) / 0.5413  # gamma(3) shape, peak ~1 at t=2tau
        # scavenging undershoot / reflection
        t2 = np.maximum((k - frac - 5 * tau) / (2.2 * tau), 0)
        pulse -= 0.32 * t2 * np.exp(1 - t2)
        start = int(math.floor(pos_j))
        ii = start + k
        if circular:
            ii %= n
            np.add.at(exh[bank], ii, amp * pulse)
        else:
            ok = ii < n
            np.add.at(exh[bank], ii[ok], amp * pulse[ok])
        # rasp gate (sharp attack, fast decay), stronger with load and rpm
        gw = int(tau * 9) + 8
        kg = np.arange(gw)
        genv = np.exp(-np.maximum(kg - frac, 0) / (tau * 2.2))
        g_amp = amp ** 1.6 * (0.25 + ld) * (1 - 0.9 * ov)
        ig = (start + kg) % n if circular else start + kg
        if circular:
            np.add.at(gate, ig, g_amp * genv)
        else:
            okg = ig < n
            np.add.at(gate, ig[okg], g_amp * genv[okg])
        # intake suction: half an interval later, smooth
        ipos = pos_j + 0.45 * interval
        iw = int(interval * 1.2) + 4
        ki = np.arange(iw)
        ienv = np.sin(np.pi * np.clip((ki - (ipos % 1)) / (interval * 1.1), 0, 1)) ** 2
        i_amp = (0.15 + 0.85 * ld) * (1 - 0.8 * ov)
        ii2 = (int(ipos) + ki) % n if circular else int(ipos) + ki
        if circular:
            np.add.at(ing, ii2, i_amp * ienv)
        else:
            ok2 = (ii2 >= 0) & (ii2 < n)
            np.add.at(ing, ii2[ok2], i_amp * ienv[ok2])
        events.append(pos)

    ex = Exhaust(n)
    f = ex.f
    # X-pipe crossover right after the collectors: each tailpipe carries both banks
    xp = 0.36 - 0.14 * cruise
    r_in = (1 - xp) * exh[0] + xp * exh[1]
    l_in = (1 - xp) * exh[1] + xp * exh[0]
    right = apply(r_in, ex.bank[0])
    left = apply(l_in, ex.bank[1])
    # the two tailpipes reach the listener with slightly different path lengths and levels
    d = int(0.0002 * SR)
    left = np.roll(left, d) if circular else np.concatenate([np.zeros(d), left[:-d]])
    exhaust = right + (0.9 - 0.12 * cruise) * left
    exhaust = apply(exhaust, ex.radiation)

    rpm_mean = float(np.mean(rpm))
    ld_mean = float(np.mean(load))
    ov_mean = float(np.mean(overrun))

    # body: weight under ~180 Hz
    body = apply(exhaust, lp_resp(f, 180, 2))
    # growl: mid band through soft saturation (drive with load)
    growl_in = apply(exhaust, bp_resp(f, 160, 1100, 1))
    s0 = np.sqrt(np.mean(growl_in ** 2)) + 1e-9
    drive = (1.2 + 2.8 * load + 1.3 * cruise * (1 - load)) * (1 - 0.6 * overrun)
    growl = np.tanh(drive * growl_in / (2.2 * s0)) * s0 * 2.2 / np.maximum(drive, 1e-3)
    growl = apply(growl, bp_resp(f, 120, 2400, 1))
    # rasp: turbulent noise gated by each blowdown pulse
    if var_period:
        # crank-synchronous turbulence: the same noise waveform per crank angle at every rpm
        # point and load, so neighbouring aligned loops stay coherent up into the rasp band
        noise = crank_noise(crank, var_period, 1)
    else:
        noise = rng.standard_normal(n)
    rasp = apply(noise * gate, bp_resp(f, 900, 4200, 2) * peak_resp(f, 1900, 1.2, 4))
    rasp *= 1 + 0.6 * extra_rasp
    # intake: induction roar + intake runner resonance (open throttle only)
    noise2 = crank_noise(crank, var_period, 2) if var_period else rng.standard_normal(n)
    intake = apply(noise2 * ing, peak_resp(f, 420, 2.5, 8) * peak_resp(f, 1250, 3, 5) * bp_resp(f, 150, 3000, 2))
    # light mechanical tick (valvetrain / injectors) at 2x event rate, high band
    tick = apply(noise * (gate > 0) * 0.3, bp_resp(f, 3500, 8000, 2))
    # hollow overrun tone: closed-throttle resonance in the pipes
    hollow = apply(exhaust, peak_resp(f, 470, 4, 9) * bp_resp(f, 200, 1500, 1))

    def norm(x):
        return x / (rms(x) + 1e-12)

    hi = min(1.0, rpm_mean / 6000.0)
    g_body = 1.0
    g_growl = 0.55 + 0.35 * ld_mean + 0.3 * cruise * (1 - ld_mean) * (1 - ov_mean)
    g_rasp = (0.06 + 0.20 * ld_mean * (0.4 + 0.6 * hi)) * (1 - 0.85 * ov_mean)
    g_intake = (0.03 + 0.14 * ld_mean * hi) * (1 - 0.8 * ov_mean)
    g_tick = 0.012
    g_hollow = 0.45 * ov_mean
    if os.environ.get("COYOTE_ANALYSIS_TONAL_ONLY"):
        g_rasp = g_intake = g_tick = 0.0
    mix = (
        g_body * norm(body) * 0.9
        + g_growl * norm(growl)
        + g_rasp * norm(rasp)
        + g_intake * norm(intake)
        + g_tick * norm(tick)
        + g_hollow * norm(hollow)
    )
    # keep the dynamics: scale back by the raw exhaust level so load/rpm still matter
    mix *= rms(exhaust)
    mix = apply(mix, hp_resp(f, 24, 2))
    # gentle soft clip of the highest peaks (pointwise, so loops stay periodic)
    c = 3.2 * rms(mix)
    mix = np.tanh(mix / c) * c
    return mix, np.array(events)


# ----------------------------------------------------------------------- calibration
# Relative band balance (dB re. 20 Hz-8 kHz total) the renders are EQ-matched to.
# Measured by spectral analysis only (0.5 s Hann frames) of LMR's public clip
# "2024-2026 Mustang GT w/ Active Exhaust: Stock Sound Clips" (Sport mode standing revs:
# idle ~720 rpm, free revs ~2,500-3,100 rpm, rev fall-off ~1,200 rpm). No reference audio is
# used in or shipped with the bank. Points above ~3,100 rpm are extrapolated guidance.
CAL_BANDS = [(20, 100), (100, 300), (300, 1000), (1000, 3000), (3000, 8000)]
CAL_TARGETS = {
    # on-load: the upper bands rise smoothly with rpm (coyote-v2.2 had a knot at 3,100 rpm
    # that lifted 3-8 kHz by 8 dB within 600 rpm: the pull turned raspy right in the
    # 3,000-4,000 rpm range and stopped sounding like the same engine)
    "on": [(700, [-6, -3, -6, -18, -30]), (2500, [-17, -4.5, -2.4, -12, -26]),
           (4000, [-17, -5, -2.8, -9.8, -20]), (5500, [-18.5, -6.5, -3, -8, -16.5]),
           (7000, [-20, -8, -3, -6.8, -13.5])],
    "light": [(700, [-1.4, -6, -16, -33, -40]), (1200, [-4, -3, -9, -25, -37]),
              (2500, [-13, -3, -4, -20, -33]), (4000, [-15, -4, -3, -16, -28]),
              (7000, [-18, -6, -3, -12, -22])],
    "over": [(950, [-3, -3.5, -11, -27, -39]), (1200, [-4.5, -2.7, -9.9, -25.7, -38]),
             (2500, [-10, -2.5, -6, -24, -38]), (7000, [-16, -4, -4, -20, -34])],
}


def cal_target(rpm: float, kind: str) -> np.ndarray:
    pts = CAL_TARGETS[kind]
    xs = [math.log(r) for r, _ in pts]
    lr = min(max(math.log(rpm), xs[0]), xs[-1])
    return np.array([np.interp(lr, xs, [v[b] for _, v in pts]) for b in range(len(CAL_BANDS))])


def band_levels(x: np.ndarray) -> np.ndarray:
    X = np.abs(np.fft.rfft(x)) ** 2
    f = freqs(len(x))
    tot = np.sum(X[(f >= 20) & (f < 8000)]) + 1e-20
    return np.array([10 * np.log10(np.sum(X[(f >= a) & (f < b)]) / tot + 1e-20) for a, b in CAL_BANDS])


def calibrate(x: np.ndarray, rpm: float, kind: str, circular: bool) -> np.ndarray:
    """Smooth EQ (interpolated in log f between band centres) towards the target balance."""
    target = cal_target(rpm, kind)
    centres = np.array([math.sqrt(a * b) for a, b in CAL_BANDS])
    y = x
    for _ in range(3):
        delta = target - band_levels(y)
        delta -= delta.max()  # only cut relative to the loudest-matching band (headroom)
        f = freqs(len(y))
        lf = np.log(np.maximum(f, 1))
        curve_db = np.interp(lf, np.log(centres), delta)
        mag = 10 ** (curve_db / 20)
        if circular:
            y = np.fft.irfft(np.fft.rfft(y) * mag, len(y))
        else:
            y = apply(y, mag)
    return y


# ----------------------------------------------------------------------------- bank

def target_rms_db(rpm: float, kind: str) -> float:
    x = math.log(rpm / 700) / math.log(7000 / 700)
    if kind == "on":
        return -15.0 + 6.5 * x
    if kind == "light":
        # idle and steady cruise sit closer to on-load than a pure dB-per-load rule:
        # level-matched against the previous V8 (idle, gentle 0-80) in the app chain
        return -18.0 + 4.0 * x
    return -25.0 + 5.0 * x  # overrun


def loop_cycles(rpm: float) -> int:
    t_cycle = 120.0 / rpm
    dur = 2.2 if rpm < 800 else 1.5 if rpm < 2000 else 1.25
    if rpm >= ALIGNED_FROM_RPM:
        return max(VAR_PERIOD, VAR_PERIOD * round(dur / t_cycle / VAR_PERIOD))
    return max(8, round(dur / t_cycle))


# Points from here up are crank-alignable at runtime (shared variation, whole multiples of
# VAR_PERIOD cycles). The 700 / 950 points (idle) are rendered exactly as in coyote-v2.2.
ALIGNED_FROM_RPM = 1250
VAR_PERIOD = 16


def cruise_char(rpm_nom: float) -> float:
    """Cross-plane cruise character: 0 at idle (700 / 950 unchanged), full from ~1,650 rpm."""
    if rpm_nom < ALIGNED_FROM_RPM:
        return 0.0
    return float(os.environ.get("COYOTE_CRUISE", "1")) * min(1.0, max(0.0, (rpm_nom - 950) / 700))


def render_loop(pi: int, rpm_nom: float, kind: str):
    ncyc = loop_cycles(rpm_nom)
    n = int(round(ncyc * 120.0 / rpm_nom * SR))
    n += n % 2
    rpm_eff = ncyc * 120.0 * SR / n
    rpm = np.full(n, rpm_eff)
    ld = {"light": 0.28, "on": 1.0, "over": 0.0}[kind]
    if rpm_nom < 800 and kind == "light":
        ld = 0.12
    load = np.full(n, ld)
    over = np.full(n, 1.0 if kind == "over" else 0.0)
    lope = max(0.0, 1 - (rpm_nom - 700) / 900)
    # idle hunting: +-0.6% rpm wobble with whole periods in the loop -> crank still wraps
    crank = None
    if rpm_nom < 800:
        t = np.arange(n) / n
        wob = 1 + 0.006 * np.sin(2 * np.pi * 2 * t) + 0.003 * np.sin(2 * np.pi * 5 * t + 1)
        deg = rpm_eff * wob * 6.0 / SR
        crank = np.cumsum(deg) - deg[0]
        crank *= (ncyc * 720.0) / (crank[-1] + deg[-1])
    # same jitter seed for all loads at one rpm point -> load variants stay phase-aligned
    sig, _ = engine_render(
        rpm, load, n, True, seed=7000 + pi * 10 + LOADS.index(kind), overrun=over,
        idle_lope=lope, jitter_seed=9100 + pi, crank=crank, cruise=cruise_char(rpm_nom),
        var_period=VAR_PERIOD if rpm_nom >= ALIGNED_FROM_RPM else None,
    )
    sig = calibrate(sig, rpm_nom, kind, True)
    sig *= 10 ** (target_rms_db(rpm_nom, kind) / 20) / rms(sig)
    return sig, rpm_eff, ncyc


def rpm_curve(n: int, pts):
    """Piecewise-smooth rpm curve from (time_s, rpm) knots (cosine interpolation)."""
    t = np.arange(n) / SR
    out = np.empty(n)
    for i in range(len(pts) - 1):
        t0, r0 = pts[i]
        t1, r1 = pts[i + 1]
        m = (t >= t0) & (t <= t1 + 1e-9)
        u = (t[m] - t0) / max(1e-6, t1 - t0)
        out[m] = r0 + (r1 - r0) * (0.5 - 0.5 * np.cos(np.pi * u))
    out[t > pts[-1][0]] = pts[-1][1]
    return out


def env_curve(n: int, pts):
    return rpm_curve(n, pts)


def oneshot(name: str):
    """Short transients (startup, bark, shifts, blip, pops). Returns (signal, base_rpm)."""
    if name == "startup":
        dur = 3.2
        n = int(dur * SR)
        # cranking ~ 210 rpm for 0.55 s, catch, flare to ~1850, settle to 700
        rpm = rpm_curve(n, [(0, 190), (0.5, 230), (0.62, 600), (0.9, 1850), (1.25, 1500), (2.1, 900), (2.9, 720), (3.2, 700)])
        load = env_curve(n, [(0, 0.0), (0.55, 0.0), (0.62, 0.9), (0.95, 0.75), (1.3, 0.25), (2.4, 0.12), (3.2, 0.12)])
        over = env_curve(n, [(0, 1.0), (0.56, 1.0), (0.62, 0.0), (3.2, 0.0)])
        sig, _ = engine_render(rpm, load, n, False, seed=31, overrun=over, idle_lope=0.6)
        sig = calibrate(sig, 900, "light", False)
        t = np.arange(n) / SR
        # starter motor: gear whine + compression strokes (crank only)
        crank_env = smoothstep((0.62 - t) / 0.08) * smoothstep(t / 0.04)
        starter = (np.sin(2 * np.pi * 1180 * t) * 0.35 + np.sin(2 * np.pi * 2360 * t) * 0.12)
        comp = 0.5 + 0.5 * np.sin(2 * np.pi * (210 / 15) * t)
        st = starter * crank_env * (0.6 + 0.4 * comp)
        sig = sig / rms(sig[int(1.4 * SR):]) * 10 ** (target_rms_db(700, "light") / 20)
        sig += st * 10 ** (-30 / 20)
        fade = smoothstep(t / 0.01)
        return sig * fade, 700
    if name == "bark":
        dur = 0.9
        n = int(dur * SR)
        rpm = rpm_curve(n, [(0, 2000), (0.05, 2050), (0.35, 2550), (0.9, 2700)])
        load = env_curve(n, [(0, 0.3), (0.03, 1.0), (0.9, 1.0)])
        xr = env_curve(n, [(0, 0), (0.03, 1.0), (0.25, 0.6), (0.9, 0.0)])
        sig, _ = engine_render(rpm, load, n, False, seed=41, extra_rasp=xr)
        sig = calibrate(sig, 2300, "on", False)
        t = np.arange(n) / SR
        # intake gulp + pressure "whomp" when the throttle snaps open
        whomp = np.sin(2 * np.pi * 62 * t) * np.exp(-t / 0.09) * smoothstep(t / 0.006)
        sig = sig / rms(sig) * 10 ** (target_rms_db(2000, "on") / 20 + 2.5 / 20)
        sig += whomp * 10 ** (-17 / 20)
        env = smoothstep(t / 0.004) * (1 - smoothstep((t - 0.55) / 0.35))
        return sig * env, 2000
    if name.startswith("blip"):
        v = int(name[-1])
        dur = 0.7
        n = int(dur * SR)
        r0 = 2000
        pk = 1.45 + 0.05 * v
        rpm = rpm_curve(n, [(0, r0), (0.04, r0 * 1.02), (0.17, r0 * pk), (0.42, r0 * (pk - 0.12)), (0.7, r0 * (pk - 0.15))])
        load = env_curve(n, [(0, 0.1), (0.03, 0.95), (0.16, 0.9), (0.22, 0.1), (0.7, 0.2)])
        over = env_curve(n, [(0, 0.6), (0.03, 0), (0.18, 0), (0.26, 0.7), (0.7, 0.5)])
        sig, _ = engine_render(rpm, load, n, False, seed=60 + v, overrun=over)
        sig = calibrate(sig, r0 * pk, "on", False)
        t = np.arange(n) / SR
        sig = sig / rms(sig[: int(0.25 * SR)]) * 10 ** (target_rms_db(r0 * pk, "on") / 20 - 2 / 20)
        env = smoothstep(t / 0.006) * (1 - smoothstep((t - 0.4) / 0.3))
        return sig * env, r0
    if name.startswith("pop"):
        v = int(name[-1])
        rng = np.random.default_rng(70 + v)
        dur = 0.26
        n = int(dur * SR)
        t = np.arange(n) / SR
        nz = rng.standard_normal(n)
        f = freqs(n)
        crack = apply(nz * np.exp(-t / (0.006 + 0.002 * v)), bp_resp(f, 500, 3800, 2) * peak_resp(f, 1400 + 300 * v, 1.5, 6))
        boom = np.sin(2 * np.pi * (70 + 12 * v) * t + 0.4) * np.exp(-t / 0.035)
        sub = apply(nz * np.exp(-t / 0.03), bp_resp(f, 120, 600, 2))
        sig = crack / rms(crack[:600]) * 0.5 + boom * 0.35 + sub / rms(sub[:1500]) * 0.12
        # through the exhaust: a bit of pipe ring, soft attack (factory muffler, not straight pipe)
        ex = Exhaust(n)
        sig = apply(sig, ex.bank[v % 2] * ex.radiation * lp_resp(freqs(n), 2200, 2))
        sig *= smoothstep(t / 0.0015) * (1 - smoothstep((t - 0.12) / 0.14))
        sig = sig / np.max(np.abs(sig)) * 10 ** (-9 / 20)
        return sig, 0
    if name.startswith("crackle"):
        return crackle_oneshot(int(name[-1])), 0
    raise ValueError(name)


def _biquad(x: np.ndarray, kind: str, f0: float, q: float, gain_db: float = 0.0) -> np.ndarray:
    """RBJ biquad (the same responses as the Web Audio BiquadFilterNode), direct form I."""
    w0 = 2 * math.pi * f0 / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2 * q)
    if kind == "lowpass":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "highpass":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bandpass":  # constant 0 dB peak gain (Web Audio "bandpass")
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "highshelf":  # Web Audio highshelf (S = 1)
        A = 10 ** (gain_db / 40)
        al = sw / 2 * math.sqrt(2)
        sa = 2 * math.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    b = [v / a[0] for v in b]
    a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xv in enumerate(x):
        yv = b[0] * xv + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xv, y1, yv
        y[i] = yv
    return y


# Racing V10 pop chain (hybrid-combustion-synth.ts), voiced with the american-muscle-v8
# exhaust formants [78, 156, 312]: modes at max(70, f * (0.85 first)), Q 6 / 4.8 / 3.6.
V10_CHAIN_MODES = [(70.0, 6.0, 1.6), (156.0, 4.8, 1.6 / 1.6), (312.0, 3.6, 1.6 / 2.2)]


def _v10_pop_impulse(seconds: float, rise: float, decay: float, noise_amt: float, seed: int) -> np.ndarray:
    """buildPopImpulse() of the Racing V10 (same LCG noise, envelope and rebound)."""
    n = max(32, round(seconds * SR))
    d = np.zeros(n)
    r = seed & 0xFFFFFFFF or 1
    lp = 0.0
    lpc = 1 - math.exp(-2 * math.pi * 1200 / SR)
    for i in range(n):
        t = i / SR
        r = (r * 1664525 + 1013904223) & 0xFFFFFFFF
        lp += ((r / 0xFFFFFFFF) * 2 - 1 - lp) * lpc
        env = (1 - math.exp(-t / rise)) * math.exp(-t / decay)
        rebound = -0.22 * math.exp(-(((t - decay * 2.2) / (decay * 1.1)) ** 2))
        fade = (n - i) / 64 if i > n - 64 else 1
        d[i] = (env * (1 - noise_amt + noise_amt * lp * 3) + rebound) * fade
    d[0] = 0
    return d


def crackle_oneshot(v: int) -> np.ndarray:
    """
    One overrun crackle exactly as the Racing V10 makes it: its 25 ms crackle impulse into
    the pop chain (body low-pass 190 Hz + pipe modes, growl saturation, 40 Hz high-pass,
    -10 dB high shelf at 800 Hz, 3.2 kHz low-pass). Variants re-tune the pipe modes like
    the V10 does per event (pipe temperature / gas speed). Peak-normalised to -9 dBFS.
    """
    detune = [0.94, 1.0, 1.07][v - 1]
    imp = _v10_pop_impulse(0.025, 0.0004, 0.0028, 0.6, 0x7C3)
    n = int(0.16 * SR)
    x = np.zeros(n)
    x[: len(imp)] = imp * 0.25  # V10 crackle level into the chain: peak * 1.2 * 0.32 * ~0.65
    s = _biquad(x, "lowpass", 190, 0.9)
    for f0, q, g in V10_CHAIN_MODES:
        s += g * _biquad(x, "bandpass", f0 * detune, q)
    k = 1.5 + 0.55 * 3.5  # growlCurve(0.55)
    s = np.tanh(k * (np.clip(s, -1, 1) + 0.18 * np.clip(s, -1, 1) ** 2)) / math.tanh(k)
    s = _biquad(s, "highpass", 40, 0.7)
    s = _biquad(s, "highshelf", 800, 0.7, -10)
    s = _biquad(s, "lowpass", 3200, 0.6)
    s -= np.mean(s)
    t = np.arange(n) / SR
    s *= 1 - smoothstep((t - (0.16 - 0.04)) / 0.04)
    return s / np.max(np.abs(s)) * 10 ** (-9 / 20)


ONESHOTS = ["startup", "bark", "blip1", "blip2", "pop1", "pop2", "pop3",
            "crackle1", "crackle2", "crackle3"]
# Keep the file gain of coyote-v2.2 so the unchanged idle loop plays at exactly the same
# level (the gain only moves if the new bank would otherwise clip).
FILE_GAIN_DB = -3.95


def main():
    out_dir = sys.argv[1]
    wav_dir = None
    if "--wav-dir" in sys.argv:
        wav_dir = sys.argv[sys.argv.index("--wav-dir") + 1]
        os.makedirs(wav_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    margin = int(MARGIN_S * SR)
    chunks = []
    cursor = 0
    loops = []
    oneshots = []
    raw = {}
    for pi, rpm_nom in enumerate(RPM_POINTS):
        for kind in LOADS:
            if rpm_nom < 800 and kind == "over":
                continue
            sig, rpm_eff, ncyc = render_loop(pi, rpm_nom, kind)
            raw[(rpm_nom, kind)] = (sig, rpm_eff, ncyc)
            n = len(sig)
            block = np.concatenate([sig[-margin:], sig, sig[:margin]])
            loops.append({
                "id": f"{kind}_{rpm_nom}",
                "load": kind,
                "rpm": round(rpm_eff, 3),
                "rpmNominal": rpm_nom,
                "cycles": ncyc,
                "start": (cursor + margin) / SR,
                "end": (cursor + margin + n) / SR,
                "frames": n,
                "rmsDb": round(db(rms(sig)), 2),
                "peakDb": round(db(float(np.max(np.abs(sig)))), 2),
            })
            chunks.append(block)
            cursor += len(block)
            if wav_dir:
                write_wav(os.path.join(wav_dir, f"loop_{kind}_{rpm_nom}.wav"), np.tile(sig, 3))
            print(f"loop {kind:5s} {rpm_nom:5d} rpm_eff={rpm_eff:8.2f} n={n} cyc={ncyc} rms={db(rms(sig)):6.2f}")
    gap_corr = gap_correlations(raw)
    loop_peak = max(float(np.max(np.abs(c[margin:-margin]))) for c in chunks)
    for name in ONESHOTS:
        sig, base = oneshot(name)
        # store one-shots no hotter than the loudest loop; the runtime restores the level
        pk = float(np.max(np.abs(sig)))
        restore = 1.0
        if pk > loop_peak:
            restore = pk / loop_peak
            sig = sig / restore
        pad = np.zeros(margin)
        start = cursor + margin
        oneshots.append({
            "id": name,
            "rpm": base,
            "start": start / SR,
            "duration": len(sig) / SR,
            "gainDb": round(db(restore), 3),
            "peakDb": round(db(float(np.max(np.abs(sig)))), 2),
        })
        chunks.append(np.concatenate([pad, sig, pad]))
        cursor += len(sig) + 2 * margin
        if wav_dir:
            write_wav(os.path.join(wav_dir, f"oneshot_{name}.wav"), sig)
        print(f"oneshot {name} {len(sig) / SR:.2f}s peak={db(float(np.max(np.abs(sig)))):.2f}")
    full = np.concatenate(chunks)
    peak = float(np.max(np.abs(full)))
    # one global gain for the whole file: relative loop levels are preserved
    file_gain = min(10 ** (FILE_GAIN_DB / 20), 10 ** (-0.5 / 20) / peak)
    full *= file_gain
    wav_path = os.path.join(out_dir, BANK_FILE.replace(".m4a", ".wav"))
    write_wav(wav_path, full)
    m4a = os.path.join(out_dir, BANK_FILE)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "aac", "-aac_coder", "twoloop", "-b:a", os.environ.get("COYOTE_BITRATE", "72k"),
        "-ac", "1", "-ar", str(SR), "-movflags", "+faststart", m4a,
    ], check=True)
    os.remove(wav_path) if not os.environ.get("KEEP_WAV") else None
    meta = {
        "version": VERSION,
        "sampleRate": SR,
        "fileGainDb": round(db(file_gain), 3),
        # loops from this rpm up are crank-alignable (shared variation, whole multiples of
        # varPeriod cycles); the runtime aligns and crossfades them coherently
        "alignedFromRpm": ALIGNED_FROM_RPM,
        "varPeriod": VAR_PERIOD,
        # broadband correlation of two crank-aligned neighbours at the gap's middle rpm
        # (key: lower point). The runtime normalises its crossfade with it, so the level
        # stays constant across the gap whether the pair is fully or partly coherent.
        "gapCorrelation": gap_corr,
        "loops": loops,
        "oneshots": oneshots,
        "bytes": os.path.getsize(m4a),
    }
    json_path = os.path.join(out_dir, "coyote_v2_bank.json")
    if "--json" in sys.argv:
        json_path = sys.argv[sys.argv.index("--json") + 1]
    with open(json_path, "w") as fh:
        json.dump(meta, fh, indent=1)
        fh.write("\n")
    print("file gain dB", round(db(file_gain), 2), "duration", round(len(full) / SR, 2), "s", "bytes", meta["bytes"])


def _at_crank(sig: np.ndarray, ncyc: int, cyc: np.ndarray) -> np.ndarray:
    n = len(sig)
    pos = np.mod(cyc, ncyc) / ncyc * n
    i = np.floor(pos).astype(np.int64)
    fr = pos - i
    return sig[i % n] * (1 - fr) + sig[(i + 1) % n] * fr


def gap_correlations(raw) -> dict:
    out = {}
    pts = [r for r in RPM_POINTS if r >= ALIGNED_FROM_RPM]
    for a, b in zip(pts, pts[1:]):
        mid = math.sqrt(a * b)
        cyc = np.arange(SR) / SR * mid / 120.0 + 0.137
        entry = {}
        for kind in LOADS:
            sa, _, na = raw[(a, kind)]
            sb, _, nb = raw[(b, kind)]
            xa = _at_crank(sa, na, cyc)
            xb = _at_crank(sb, nb, cyc)
            entry[kind] = round(float(np.sum(xa * xb) / math.sqrt(np.sum(xa * xa) * np.sum(xb * xb))), 3)
        out[str(a)] = entry
    return out


def write_wav(path: str, x: np.ndarray):
    import wave
    y = np.clip(x, -1, 1)
    pcm = (y * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


if __name__ == "__main__":
    main()
