import type { MusicClock } from "./music-clock";
import { overlayBufferId, oneshotBufferId } from "./pack-loader";
import type { StemPlayer } from "./stem-player";
import type { EdmDriveInput, EdmMachine, EdmSnapshot } from "./viral-edm-machine";

interface SynthBuf {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

function makeKickBuffer(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.5);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 175 * Math.exp(-t * 22) + 40;
    phase += (2 * Math.PI * f) / sr;
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.28;
    d[i] = Math.sin(phase) * Math.exp(-t * 5.8) + click;
  }
  return buf;
}

function makeSnareBuffer(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.28);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 18) * 0.35;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14);
    d[i] = tone + noise * 0.7;
  }
  return buf;
}

function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

export function createViralEdm(
  ctx: BaseAudioContext,
  stems: StemPlayer,
  clock: MusicClock,
  buffers: Map<string, AudioBuffer> | undefined,
  ducks: { bed: GainNode; hook: GainNode },
) {
  const dest = stems.bus;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(dest);

  const dropBus = ctx.createGain();
  dropBus.gain.value = 0.0001;
  const dropDuck = ctx.createGain();
  dropDuck.gain.value = 1;
  dropBus.connect(dropDuck);
  dropDuck.connect(bus);

  const melBus = ctx.createGain();
  melBus.gain.value = 0.0001;
  const melDuck = ctx.createGain();
  melDuck.gain.value = 1;
  melBus.connect(melDuck);
  melDuck.connect(bus);

  const pianoBus = ctx.createGain();
  pianoBus.gain.value = 0.0001;
  const pianoBedGain = ctx.createGain();
  pianoBedGain.gain.value = 0.0001;
  const pianoMelGain = ctx.createGain();
  pianoMelGain.gain.value = 0.0001;
  const pianoDuck = ctx.createGain();
  pianoDuck.gain.value = 1;
  pianoBedGain.connect(pianoBus);
  pianoMelGain.connect(pianoBus);
  pianoBus.connect(pianoDuck);
  pianoDuck.connect(bus);

  const choirBus = ctx.createGain();
  choirBus.gain.value = 0.0001;
  const choirBedGain = ctx.createGain();
  choirBedGain.gain.value = 0.0001;
  const choirMelGain = ctx.createGain();
  choirMelGain.gain.value = 0.0001;
  const choirDuck = ctx.createGain();
  choirDuck.gain.value = 1;
  choirBedGain.connect(choirBus);
  choirMelGain.connect(choirBus);
  choirBus.connect(choirDuck);
  choirDuck.connect(bus);

  const kickBuf = makeKickBuffer(ctx);
  const snareBuf = makeSnareBuffer(ctx);
  const noiseBuf = makeNoiseBuffer(ctx, 2);

  const live: SynthBuf[] = [];
  const loops: { id: string; source: AudioBufferSourceNode; gain: GainNode }[] = [];
  let late = 0;
  let started = false;
  let armedBuild = -1;
  let armedDrop = -1;
  let armedMelodic = -1;
  let lastPhase = "bed";
  const scheduledKicks = new Set<number>();

  function playBuf(
    buffer: AudioBuffer,
    at: number,
    gain: number,
    destNode: AudioNode,
    playbackRate = 1,
  ) {
    const g = ctx.createGain();
    g.gain.value = gain;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;
    src.connect(g);
    g.connect(destNode);
    try {
      src.start(at);
    } catch {
      late += 1;
      return;
    }
    const node = { source: src, gain: g };
    live.push(node);
    src.onended = () => {
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* */
      }
      const i = live.indexOf(node);
      if (i >= 0) live.splice(i, 1);
    };
  }

  function pump(at: number, depth: number, beatDur: number) {
    const bed = Math.max(0.0001, 1 - depth);
    const hook = Math.max(0.0001, 1 - depth * 0.35);
    const tau = Math.max(0.05, beatDur * 0.2);
    try {
      ducks.bed.gain.setValueAtTime(bed, at);
      ducks.bed.gain.setTargetAtTime(1, at + 0.015, tau);
      ducks.hook.gain.setValueAtTime(hook, at);
      ducks.hook.gain.setTargetAtTime(1, at + 0.015, tau);
      dropDuck.gain.setValueAtTime(Math.max(0.0001, 1 - depth * 0.55), at);
      dropDuck.gain.setTargetAtTime(1, at + 0.015, tau);
      melDuck.gain.setValueAtTime(Math.max(0.0001, 1 - depth * 0.7), at);
      melDuck.gain.setTargetAtTime(1, at + 0.015, tau);
      pianoDuck.gain.setValueAtTime(Math.max(0.0001, 1 - depth * 0.25), at);
      pianoDuck.gain.setTargetAtTime(1, at + 0.015, tau);
      choirDuck.gain.setValueAtTime(Math.max(0.0001, 1 - depth * 0.45), at);
      choirDuck.gain.setTargetAtTime(1, at + 0.015, tau);
    } catch {
      late += 1;
    }
  }

  function startLoop(
    id: string,
    buffer: AudioBuffer,
    destNode: AudioNode,
    at: number,
    gain: number,
  ) {
    stopLoop(id, at);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(g);
    g.connect(destNode);
    try {
      src.start(at);
      g.gain.setTargetAtTime(gain, at, 0.08);
    } catch {
      late += 1;
      return;
    }
    loops.push({ id, source: src, gain: g });
  }

  function stopLoop(id: string, at: number) {
    for (const loop of loops.filter((l) => l.id === id)) {
      try {
        loop.gain.gain.setTargetAtTime(0.0001, at, 0.06);
        loop.source.stop(at + 0.35);
      } catch {
        late += 1;
      }
    }
  }

  function stopAllLoops(at: number) {
    for (const loop of loops) {
      try {
        loop.gain.gain.setTargetAtTime(0.0001, at, 0.08);
        loop.source.stop(at + 0.4);
      } catch {
        late += 1;
      }
    }
  }

  function scheduleBuild(start: number, barDur: number, beatDur: number) {
    const total = 8 * barDur;
    // Rising white-noise riser across the whole build.
    const riserGain = ctx.createGain();
    riserGain.gain.value = 0.0001;
    const riserFilter = ctx.createBiquadFilter();
    riserFilter.type = "highpass";
    riserFilter.frequency.value = 400;
    const riser = ctx.createBufferSource();
    riser.buffer = noiseBuf;
    riser.loop = true;
    riser.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(bus);
    try {
      riser.start(start);
      riser.stop(start + total);
      riserGain.gain.setValueAtTime(0.03, start);
      riserGain.gain.exponentialRampToValueAtTime(0.28, start + total - beatDur);
      riserGain.gain.exponentialRampToValueAtTime(0.0001, start + total - 0.08);
      riserFilter.frequency.setValueAtTime(400, start);
      riserFilter.frequency.exponentialRampToValueAtTime(8000, start + total - beatDur);
    } catch {
      late += 1;
    }
    live.push({ source: riser, gain: riserGain });

    // Pitch-rising saw.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const oscF = ctx.createBiquadFilter();
    oscF.type = "lowpass";
    oscF.frequency.value = 1200;
    oscF.Q.value = 6;
    const oscG = ctx.createGain();
    oscG.gain.value = 0.0001;
    osc.connect(oscF);
    oscF.connect(oscG);
    oscG.connect(bus);
    try {
      osc.frequency.setValueAtTime(midiToHz(49), start);
      osc.frequency.exponentialRampToValueAtTime(midiToHz(85), start + total - beatDur);
      oscF.frequency.setValueAtTime(800, start);
      oscF.frequency.exponentialRampToValueAtTime(4200, start + total - beatDur);
      oscG.gain.setValueAtTime(0.04, start);
      oscG.gain.linearRampToValueAtTime(0.16, start + total - beatDur);
      oscG.gain.exponentialRampToValueAtTime(0.0001, start + total - 0.08);
      osc.start(start);
      osc.stop(start + total);
    } catch {
      late += 1;
    }

    // Snare / clap roll: bars 1-2 quarters, 3-4 8ths, 5-6 16ths, 7-8 32nds.
    // Last beat of bar 8 is silent (gap before the drop).
    const end = start + total;
    const muteFrom = end - beatDur;
    let step = beatDur;
    for (let bar = 0; bar < 8; bar++) {
      if (bar < 2) step = beatDur;
      else if (bar < 4) step = beatDur / 2;
      else if (bar < 6) step = beatDur / 4;
      else step = beatDur / 8;
      const barStart = start + bar * barDur;
      const barEnd = barStart + barDur;
      for (let t = barStart; t < barEnd - 1e-4; t += step) {
        if (t >= muteFrom) break;
        const p = (t - start) / total;
        const g = 0.28 + 0.5 * p;
        playBuf(snareBuf, t, g, bus, 0.95 + 0.1 * p);
      }
    }

    // Pre-drop vocal: Hey or ElCA on the last 8th before the gap, i.e. just into the last beat.
    const elca = buffers?.get(oneshotBufferId("elca"));
    const hey = buffers?.get(oneshotBufferId("hey-1"));
    const cue = elca ?? hey;
    if (cue) playBuf(cue, muteFrom - beatDur * 0.5, 0.85, bus);
  }

  function scheduleDrop(start: number, barDur: number, beatDur: number, depth: number) {
    const bars = 8;
    const hookNotes = [73, 73, 76, 78, 76, 73, 71, 73, 76, 78, 80, 78, 76, 75, 73, 71];
    for (let i = 0; i < bars * 4; i++) {
      const at = start + i * beatDur;
      playBuf(kickBuf, at, 0.72, dropBus);
      pump(at, depth, beatDur);
      // Offbeat clap
      if (i % 2 === 1) playBuf(snareBuf, at, 0.32, dropBus, 1);
    }
    // Sub / bass: held notes per bar, ducked by the same pump (on dropDuck).
    const roots = [49, 49, 45, 52, 49, 49, 45, 52]; // C# C# A E
    for (let bar = 0; bar < bars; bar++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      osc.frequency.value = midiToHz(roots[bar] ?? 49);
      osc.connect(g);
      g.connect(dropBus);
      const at = start + bar * barDur;
      try {
        osc.start(at);
        osc.stop(at + barDur);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.42, at + 0.03);
        g.gain.setTargetAtTime(0.0001, at + barDur - 0.05, 0.04);
      } catch {
        late += 1;
      }
    }
    // Supersaw / plucked hook, 8ths.
    const eighth = beatDur / 2;
    for (let i = 0; i < hookNotes.length * 2; i++) {
      const midi = hookNotes[i % hookNotes.length] ?? 73;
      const at = start + i * eighth;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      osc.frequency.value = midiToHz(midi);
      osc.connect(f);
      f.connect(g);
      g.connect(dropBus);
      try {
        osc.start(at);
        osc.stop(at + eighth * 0.9);
        g.gain.setValueAtTime(0.1, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + eighth * 0.85);
      } catch {
        late += 1;
      }
    }
    const moso = buffers?.get(oneshotBufferId("moso"));
    if (moso) playBuf(moso, start, 0.7, bus);
    // Second MOSO mid-drop (bar 5 downbeat)
    if (moso) playBuf(moso, start + 4 * barDur, 0.6, bus);
  }

  function scheduleMelodic(start: number) {
    const piano = buffers?.get(overlayBufferId("melodic-piano"));
    const arp = buffers?.get(overlayBufferId("melodic-arp"));
    const pads = buffers?.get(overlayBufferId("melodic-pads"));
    const soar = buffers?.get(overlayBufferId("melodic-soar"));
    if (piano) startLoop("piano", piano, melBus, start, 1.25);
    if (arp) startLoop("arp", arp, melBus, start, 0.95);
    if (pads) startLoop("pads", pads, melBus, start, 1.15);
    if (soar) startLoop("soar", soar, melBus, start, 1.4);
  }

  function scheduleMelodicKicks(snap: EdmSnapshot, audioTime: number, beatDur: number) {
    if (snap.phase !== "melodic" || snap.phaseStartedAt == null || snap.phaseEndsAt == null) return;
    const start = Math.max(audioTime, snap.phaseStartedAt);
    const until = Math.min(audioTime + 0.4, snap.phaseEndsAt);
    const first =
      snap.phaseStartedAt + Math.ceil((start - snap.phaseStartedAt - 1e-4) / beatDur) * beatDur;
    for (let t = first; t < until - 1e-4; t += beatDur) {
      if (t < audioTime - 0.02) continue;
      const key = Math.round(t * 1000);
      if (scheduledKicks.has(key)) continue;
      scheduledKicks.add(key);
      playBuf(kickBuf, t, 0.78, melBus);
      pump(t, snap.sidechainDepth, beatDur);
    }
  }

  return {
    get lateEvents() {
      return late;
    },
    start(audioTime: number) {
      started = true;
      const pBed = buffers?.get(overlayBufferId("acoustic-piano"));
      const pMel = buffers?.get(overlayBufferId("acoustic-piano-melodic"));
      const cBed = buffers?.get(overlayBufferId("choir"));
      const cMel = buffers?.get(overlayBufferId("choir-melodic"));
      if (pBed) startLoop("acoustic-piano", pBed, pianoBedGain, audioTime, 1);
      if (pMel) startLoop("acoustic-piano-melodic", pMel, pianoMelGain, audioTime, 1);
      if (cBed) startLoop("choir", cBed, choirBedGain, audioTime, 1);
      if (cMel) startLoop("choir-melodic", cMel, choirMelGain, audioTime, 1);
    },
    update(input: EdmDriveInput, snap: EdmSnapshot, audioTime: number) {
      if (!started) return;
      const barDur = input.barDuration;
      const beatDur = barDur / 4;
      stems.setMixHp(snap.filterHz, audioTime, snap.phase === "build" ? 0.12 : 0.06);
      stems.setMakeup(snap.makeup, audioTime, 0.1);
      if (snap.phase === "drop" && lastPhase !== "drop" && snap.phaseStartedAt != null) {
        stems.snapMixHp(30, snap.phaseStartedAt);
      }

      try {
        dropBus.gain.setTargetAtTime(Math.max(0.0001, snap.dropGain), audioTime, 0.04);
        melBus.gain.setTargetAtTime(Math.max(0.0001, snap.melodicGain), audioTime, 0.08);
        const useMelodic = snap.phase === "melodic" ? 1 : 0;
        pianoBedGain.gain.setTargetAtTime(Math.max(0.0001, 1 - useMelodic), audioTime, 0.08);
        pianoMelGain.gain.setTargetAtTime(Math.max(0.0001, useMelodic), audioTime, 0.08);
        choirBedGain.gain.setTargetAtTime(Math.max(0.0001, 1 - useMelodic), audioTime, 0.08);
        choirMelGain.gain.setTargetAtTime(Math.max(0.0001, useMelodic), audioTime, 0.08);
        const pianoTau = snap.lastBarOfBuild ? 0.04 : 0.1;
        pianoBus.gain.setTargetAtTime(
          Math.max(0.0001, snap.acousticPianoGain),
          audioTime,
          pianoTau,
        );
        choirBus.gain.setTargetAtTime(Math.max(0.0001, snap.choirGain), audioTime, 0.1);
      } catch {
        late += 1;
      }

      if (
        snap.phase === "build" &&
        snap.phaseStartedAt != null &&
        armedBuild !== snap.phaseStartedAt
      ) {
        armedBuild = snap.phaseStartedAt;
        scheduleBuild(snap.phaseStartedAt, barDur, beatDur);
      }
      if (
        snap.phase === "drop" &&
        snap.phaseStartedAt != null &&
        armedDrop !== snap.phaseStartedAt
      ) {
        armedDrop = snap.phaseStartedAt;
        stopAllLoops(audioTime);
        scheduleDrop(snap.phaseStartedAt, barDur, beatDur, snap.sidechainDepth);
      }
      if (
        snap.phase === "melodic" &&
        snap.phaseStartedAt != null &&
        armedMelodic !== snap.phaseStartedAt
      ) {
        armedMelodic = snap.phaseStartedAt;
        scheduleMelodic(snap.phaseStartedAt);
      }
      if (snap.phase === "melodic") scheduleMelodicKicks(snap, audioTime, beatDur);
      if (snap.phase === "bed" && lastPhase !== "bed") {
        scheduledKicks.clear();
        stopAllLoops(audioTime);
        try {
          dropBus.gain.setTargetAtTime(0.0001, audioTime, 0.08);
          melBus.gain.setTargetAtTime(0.0001, audioTime, 0.08);
        } catch {
          late += 1;
        }
      }
      lastPhase = snap.phase;
    },
    dispose() {
      for (const n of live) {
        try {
          n.source.stop();
          n.source.disconnect();
          n.gain.disconnect();
        } catch {
          /* */
        }
      }
      live.length = 0;
      for (const loop of loops) {
        try {
          loop.source.stop();
          loop.source.disconnect();
          loop.gain.disconnect();
        } catch {
          /* */
        }
      }
      loops.length = 0;
      try {
        bus.disconnect();
        dropBus.disconnect();
        dropDuck.disconnect();
        melBus.disconnect();
        pianoBus.disconnect();
        choirBus.disconnect();
        pianoBedGain.disconnect();
        pianoMelGain.disconnect();
        choirBedGain.disconnect();
        choirMelGain.disconnect();
        pianoDuck.disconnect();
        choirDuck.disconnect();
        melDuck.disconnect();
      } catch {
        /* */
      }
    },
  };
}

export type ViralEdm = ReturnType<typeof createViralEdm>;
