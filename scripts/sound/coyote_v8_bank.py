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
VERSION = "coyote-v2.2"


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
):
    """
    Render engine audio for per-sample rpm / load (0..1) / overrun (0..1, fuel cut).
    circular=True requires the crank phase to wrap exactly at n (constant rpm loops).
    Returns the mono mix (float64, not normalised) and the event times (samples).
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
    exh = [np.zeros(n), np.zeros(n)]
    gate = np.zeros(n)  # rasp gate (turbulent blowdown)
    ing = np.zeros(n)  # intake suction envelope
    events = []
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
        jt = sig_t * jrng.standard_normal() + cyl_skew[cyl] * interval
        pos_j = pos + jt
        if circular:
            pos_j %= n
        # combustion strength: load sets fuel; overrun has none (pumping only)
        strength = (0.32 + 0.68 * ld) * (1 - 0.86 * ov)
        amp = strength * cyl_trim[cyl] * max(0.15, 1 + sig_a * rng.standard_normal())
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
    xp = 0.36
    r_in = (1 - xp) * exh[0] + xp * exh[1]
    l_in = (1 - xp) * exh[1] + xp * exh[0]
    right = apply(r_in, ex.bank[0])
    left = apply(l_in, ex.bank[1])
    # the two tailpipes reach the listener with slightly different path lengths and levels
    d = int(0.0002 * SR)
    left = np.roll(left, d) if circular else np.concatenate([np.zeros(d), left[:-d]])
    exhaust = right + 0.9 * left
    exhaust = apply(exhaust, ex.radiation)

    rpm_mean = float(np.mean(rpm))
    ld_mean = float(np.mean(load))
    ov_mean = float(np.mean(overrun))

    # body: weight under ~180 Hz
    body = apply(exhaust, lp_resp(f, 180, 2))
    # growl: mid band through soft saturation (drive with load)
    growl_in = apply(exhaust, bp_resp(f, 160, 1100, 1))
    s0 = np.sqrt(np.mean(growl_in ** 2)) + 1e-9
    drive = (1.2 + 2.8 * load) * (1 - 0.6 * overrun)
    growl = np.tanh(drive * growl_in / (2.2 * s0)) * s0 * 2.2 / np.maximum(drive, 1e-3)
    growl = apply(growl, bp_resp(f, 120, 2400, 1))
    # rasp: turbulent noise gated by each blowdown pulse
    noise = rng.standard_normal(n)
    rasp = apply(noise * gate, bp_resp(f, 900, 4200, 2) * peak_resp(f, 1900, 1.2, 4))
    rasp *= 1 + 0.6 * extra_rasp
    # intake: induction roar + intake runner resonance (open throttle only)
    noise2 = rng.standard_normal(n)
    intake = apply(noise2 * ing, peak_resp(f, 420, 2.5, 8) * peak_resp(f, 1250, 3, 5) * bp_resp(f, 150, 3000, 2))
    # light mechanical tick (valvetrain / injectors) at 2x event rate, high band
    tick = apply(noise * (gate > 0) * 0.3, bp_resp(f, 3500, 8000, 2))
    # hollow overrun tone: closed-throttle resonance in the pipes
    hollow = apply(exhaust, peak_resp(f, 470, 4, 9) * bp_resp(f, 200, 1500, 1))

    def norm(x):
        return x / (rms(x) + 1e-12)

    hi = min(1.0, rpm_mean / 6000.0)
    g_body = 1.0
    g_growl = 0.55 + 0.35 * ld_mean
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
    "on": [(700, [-6, -3, -6, -18, -30]), (2500, [-17, -4.5, -2.4, -12, -26]),
           (3100, [-16, -4, -3, -9.5, -18]), (5000, [-18, -6, -3, -7.5, -15]),
           (7000, [-20, -8, -3, -6.5, -13])],
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
    return max(8, round(dur / t_cycle))


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
        idle_lope=lope, jitter_seed=9100 + pi, crank=crank,
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
    if name.startswith("upshift"):
        v = int(name[-1])
        dur = 0.55
        n = int(dur * SR)
        r0 = 4000
        rpm = rpm_curve(n, [(0, r0), (0.06, r0 * 0.99), (0.28, r0 * 0.70), (0.55, r0 * 0.69)])
        load = env_curve(n, [(0, 1.0), (0.04, 0.15), (0.2, 0.2), (0.3, 1.0), (0.55, 1.0)])
        over = env_curve(n, [(0, 0), (0.05, 0.7 + 0.1 * v), (0.22, 0.5), (0.3, 0), (0.55, 0)])
        sig, _ = engine_render(rpm, load, n, False, seed=50 + v, overrun=over)
        sig = calibrate(sig, r0 * 0.85, "on", False)
        t = np.arange(n) / SR
        thump = np.sin(2 * np.pi * (48 + 6 * v) * t) * np.exp(-np.maximum(t - 0.27, 0) / 0.05) * smoothstep((t - 0.27) / 0.008)
        sig = sig / rms(sig) * 10 ** (target_rms_db(r0, "on") / 20 - 3 / 20)
        sig += thump * 10 ** (-22 / 20)
        env = smoothstep(t / 0.01) * (1 - smoothstep((t - 0.4) / 0.15))
        return sig * env, r0
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
    raise ValueError(name)


ONESHOTS = ["startup", "bark", "upshift1", "upshift2", "blip1", "blip2", "pop1", "pop2", "pop3"]


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
    for pi, rpm_nom in enumerate(RPM_POINTS):
        for kind in LOADS:
            if rpm_nom < 800 and kind == "over":
                continue
            sig, rpm_eff, ncyc = render_loop(pi, rpm_nom, kind)
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
    file_gain = 10 ** (-1.5 / 20) / peak
    full *= file_gain
    wav_path = os.path.join(out_dir, "coyote_v2_bank.wav")
    write_wav(wav_path, full)
    m4a = os.path.join(out_dir, "coyote_v2_bank.m4a")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "aac", "-aac_coder", "twoloop", "-b:a", os.environ.get("COYOTE_BITRATE", "72k"),
        "-ac", "1", "-ar", str(SR), "-movflags", "+faststart", m4a,
    ], check=True)
    os.remove(wav_path) if not os.environ.get("KEEP_WAV") else None
    meta = {
        "version": VERSION,
        "sampleRate": SR,
        "fileGainDb": round(db(file_gain), 3),
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
