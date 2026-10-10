/**
 * American Muscle V8 pilot comparison pack.
 *
 * Renders ELCAMOSO Muscle V2 (untouched + loudness-matched), copies research
 * extracts beside them for private A/B, and writes supported meters only.
 * Does NOT approve research files or claim reference-compared / listening gates.
 */
import { chromium } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

const outputDir = path.resolve(
  process.env.MUSCLE_PILOT_OUT ?? "artifacts/audio-comparisons/american-muscle-v8-pilot-2026-10-10",
);
const researchDir = path.resolve(
  "ELCAMOSO_Sound_Profile_Package/Videos for sound profiles/trimmed-minus-5s/extracted-labeled-audio",
);
const researchFiles = ["V8_source-1.wav", "V8_source-2.wav", "V8_source-7.wav"];
const targetLufs = -20;

/** Segment windows inside the shared 16.5 s comparisonReplayInput timeline. */
const SEGMENTS = [
  { id: "idle", label: "idle", start: 0.2, end: 0.95 },
  { id: "steady-cruise", label: "steady RPM / cruise", start: 5.2, end: 6.8 },
  { id: "loaded-acceleration", label: "loaded acceleration", start: 3.2, end: 4.9 },
  { id: "lift-off", label: "lift-off", start: 7.05, end: 7.95 },
  { id: "shift-window", label: "shift (first gear change ±0.35 s)", start: null, end: null },
];

function applyGainToPcm16(wav, gainDb) {
  const output = Buffer.from(wav);
  const gain = 10 ** (gainDb / 20);
  for (let offset = 44; offset + 1 < output.length; offset += 2) {
    const sample = output.readInt16LE(offset);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * gain))), offset);
  }
  return output;
}

function round(value, places = 2) {
  return Number(value.toFixed(places));
}

function sliceWavPcm16(wav, startSec, endSec) {
  const sampleRate = wav.readUInt32LE(24);
  const channels = wav.readUInt16LE(22);
  const bits = wav.readUInt16LE(34);
  if (bits !== 16) throw new Error(`Expected PCM16 render, got ${bits}-bit`);
  const frameBytes = channels * 2;
  const dataStart = 44;
  const totalFrames = Math.floor((wav.length - dataStart) / frameBytes);
  const startFrame = Math.max(0, Math.min(totalFrames, Math.round(startSec * sampleRate)));
  const endFrame = Math.max(startFrame + 1, Math.min(totalFrames, Math.round(endSec * sampleRate)));
  const frames = endFrame - startFrame;
  const pcm = wav.subarray(dataStart + startFrame * frameBytes, dataStart + endFrame * frameBytes);
  const out = Buffer.alloc(44 + pcm.length);
  wav.copy(out, 0, 0, 44);
  out.writeUInt32LE(36 + pcm.length, 4);
  out.writeUInt32LE(pcm.length, 40);
  pcm.copy(out, 44);
  return { wav: out, sampleRate, channels, frames, durationSeconds: frames / sampleRate };
}

function analysePcm16(wav) {
  const channels = wav.readUInt16LE(22);
  const data = wav.subarray(44);
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  const samples = data.length / 2;
  for (let i = 0; i < samples; i += 1) {
    const s = data.readInt16LE(i * 2) / 32768;
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
    if (Math.abs(s) >= 0.999) clipped += 1;
  }
  const rms = Math.sqrt(sum / Math.max(1, samples));
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);
  return {
    peakDbfs: db(peak),
    rmsDbfs: db(rms),
    clippedSamples: clipped,
    channels,
    approximateIntegratedLufs: db(rms) - 0.691, // crude K-ish offset; not certified LUFS
  };
}

async function inventoryResearchFile(fileName) {
  const full = path.join(researchDir, fileName);
  const buf = await readFile(full);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const sampleRate = buf.readUInt32LE(24);
  const channels = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  let off = 12;
  let dataOff = 44;
  let dataSize = buf.length - 44;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") {
      dataOff = off + 8;
      dataSize = size;
      break;
    }
    off += 8 + size + (size % 2);
  }
  const frames = Math.floor(dataSize / (channels * (bits / 8)));
  let peak = 0;
  let sum = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(frames / 20000));
  if (bits === 24) {
    for (let i = 0; i < frames; i += step) {
      let v = buf.readIntLE(dataOff + i * channels * 3, 3);
      if (v & 0x800000) v |= ~0xffffff;
      const s = v / 8388608;
      peak = Math.max(peak, Math.abs(s));
      sum += s * s;
      n += 1;
    }
  }
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);
  return {
    fileName,
    sampleRate,
    channels,
    bitDepth: bits,
    durationSeconds: round(frames / sampleRate, 3),
    peakDbfs: round(db(peak), 1),
    rmsDbfs: round(db(Math.sqrt(sum / Math.max(1, n))), 1),
    sha256,
    licenseApproval: "unknown",
    pilotEligible: false,
    engineIdentityVerified: false,
    rpmAnchor: null,
  };
}

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.join(outputDir, "research-extracts"), { recursive: true });
  await mkdir(path.join(outputDir, "segments"), { recursive: true });

  const result = await page.evaluate(async () => {
    const module = await import("/src/lib/sound/validation/offline-comparison.ts");
    return module.renderOfflineComparison("american-muscle-v8", "tuned");
  });
  const fullWav = Buffer.from(result.wavBase64, "base64");
  delete result.wavBase64;
  const headroomGainDb = -1 - result.stats.peakDbfs;
  const loudnessGainDb = targetLufs - result.stats.approximateIntegratedLufs;
  const matchedGainDb = Math.min(headroomGainDb, loudnessGainDb);
  await writeFile(path.join(outputDir, "elcamoso-full-untouched.wav"), fullWav);
  await writeFile(
    path.join(outputDir, "elcamoso-full-loudness-matched.wav"),
    applyGainToPcm16(fullWav, matchedGainDb),
  );

  const firstShift = result.stats.shiftStartSeconds?.[0] ?? 5.5;
  const segmentDefs = SEGMENTS.map((seg) => {
    if (seg.id !== "shift-window") return seg;
    return { ...seg, start: Math.max(0, firstShift - 0.35), end: firstShift + 0.55 };
  });

  const segments = [];
  for (const seg of segmentDefs) {
    const sliced = sliceWavPcm16(fullWav, seg.start, seg.end);
    const stats = analysePcm16(sliced.wav);
    const segHeadroom = -1 - stats.peakDbfs;
    const segLoudness = targetLufs - stats.approximateIntegratedLufs;
    const segGain = Math.min(segHeadroom, segLoudness);
    const stem = `elcamoso-${seg.id}`;
    await writeFile(path.join(outputDir, "segments", `${stem}-untouched.wav`), sliced.wav);
    await writeFile(
      path.join(outputDir, "segments", `${stem}-loudness-matched.wav`),
      applyGainToPcm16(sliced.wav, segGain),
    );
    segments.push({
      id: seg.id,
      label: seg.label,
      start: seg.start,
      end: seg.end,
      durationSeconds: sliced.durationSeconds,
      stats: {
        peakDbfs: round(stats.peakDbfs),
        rmsDbfs: round(stats.rmsDbfs),
        clippedSamples: stats.clippedSamples,
        approximateIntegratedLufs: round(stats.approximateIntegratedLufs),
      },
      matchedGainDb: round(segGain),
    });
    process.stdout.write(`${stem}: ${round(sliced.durationSeconds, 2)} s\n`);
  }

  const research = [];
  for (const fileName of researchFiles) {
    const src = path.join(researchDir, fileName);
    if (!existsSync(src)) {
      research.push({ fileName, missing: true });
      continue;
    }
    await copyFile(src, path.join(outputDir, "research-extracts", fileName));
    research.push(await inventoryResearchFile(fileName));
    process.stdout.write(`research copy: ${fileName}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    profileId: "american-muscle-v8",
    variant: "tuned",
    backend: result.backend,
    excitationMode: result.excitationMode,
    gates: {
      implemented: true,
      technicallyVerified: true,
      referenceCompared: false,
      listeningApproved: false,
      referenceComparedReason:
        "Research V8 extracts lack approved license, verified muscle identity, RPM/load anchors, and steady-loop metadata. Copied for private A/B only.",
    },
    fullRender: {
      durationSeconds: result.durationSeconds,
      stats: result.stats,
      matchedGainDb: round(matchedGainDb),
      v2: result.v2 ?? null,
      activeNodeEstimate: result.activeNodeEstimate,
    },
    segments,
    researchExtracts: research,
    meterNote:
      "Approximate meters only (sample peak, RMS, crude LUFS-like). Not true-peak or certified LUFS. No Tesla cabin test performed.",
  };
  await writeFile(path.join(outputDir, "analysis.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Wrote ${outputDir}\n`);
} finally {
  await browser?.close();
  await server.close();
}
