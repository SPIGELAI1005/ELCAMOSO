import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const docsDir = path.join(root, "docs/sound-profiles");
const output = path.join(root, "docs/audio/profile-upgrade-matrix.md");

function section(markdown, heading) {
  return markdown.match(new RegExp(`## ${heading}\\s+([\\s\\S]*?)(?=\\n## |$)`))?.[1]?.trim() ?? "Unknown";
}

function bullets(markdown, heading) {
  return section(markdown, heading)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function inline(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n+/g, " ").trim();
}

const closest = {
  "gt-v8": "american-muscle-v8", "american-muscle-v8": "gt-v8", "flat-six-sport": "turbo-inline-6",
  "turbo-inline-6": "flat-six-sport", "racing-v10": "race-car", "race-car": "racing-v10",
  "rally-car": "turbo-inline-6", "motorcycle-superbike": "race-car", "big-twin": "american-muscle-v8",
  "wiesn-tractor": "big-twin", "cyber-pulse": "electric-hypercar", "electric-hypercar": "formula-electric",
  "formula-electric": "electric-hypercar", "space-ship": "world-space-drive", "ufo": "space-ship",
  "speed-boat": "jet-ski", "jet-ski": "speed-boat", "cruise-ship": "speed-boat",
  "santa-sleigh": "wild-west-carriage", "wild-west-carriage": "romanian-85-carriage",
  "romanian-85-carriage": "wild-west-carriage", "horse-gallop": "wild-west-carriage",
  "laughing-machine": "farting-car", "farting-car": "kazoo-kart", "kazoo-kart": "farting-car",
  "steam-train": "high-speed-train", "turbine-jet": "private-jet", "private-jet": "turbine-jet",
  "helicopter": "turbine-jet", "open-wind": "storm-glider", "storm-glider": "world-storm-run",
  "neon-drive": "synthwave-drive", "maglev-train": "high-speed-train", "high-speed-train": "maglev-train",
  "submarine": "cruise-ship", "snowmobile": "motorcycle-superbike", "tank": "construction-monster",
  "construction-monster": "tank", "dragon": "thunder-beast", "thunder-beast": "dragon",
  "retro-arcade": "synthwave-drive", "synthwave-drive": "neon-drive", "deep-bass-pulse": "heartbeat",
  "zen-drive": "ocean-drive", "rain-drive": "open-wind", "ocean-drive": "zen-drive", "heartbeat": "deep-bass-pulse",
  "symphony-cinematic-rock": "symphony-motion-orchestra", "symphony-motion-orchestra": "symphony-cinematic-rock",
  "symphony-neon-run": "neon-drive", "world-space-drive": "space-ship", "world-cyber-city": "neon-drive",
  "world-storm-run": "storm-glider", "fusion-road-anthem": "fusion-mechanical-symphony",
  "fusion-mechanical-symphony": "fusion-road-anthem", "fusion-midnight-boost": "fusion-road-anthem",
  "fusion-future-pulse": "electric-hypercar",
};

const explicitFamily = {
  "gt-v8": "cross-plane V8 (configured)", "american-muscle-v8": "cross-plane V8 lope (configured)",
  "flat-six-sport": "flat-six (configured)", "turbo-inline-6": "turbo inline-six (configured)",
  "racing-v10": "even V10 (configured)", "race-car": "flat-plane V8 (configured)",
  "rally-car": "turbo inline-three (configured)", "motorcycle-superbike": "inline-four motorcycle (configured)",
  "big-twin": "V-twin (configured)", "wiesn-tractor": "single-cylinder two-stroke (documented)",
  "electric-hypercar": "fictional multi-speed EV", "formula-electric": "fictional competition EV",
  "cyber-pulse": "fictional continuous EV",
};

const files = (await readdir(docsDir)).filter((name) => name.endsWith(".md") && name !== "INDEX.md");
const design = new Map();
for (const file of files) {
  const markdown = await readFile(path.join(docsDir, file), "utf8");
  const id = markdown.match(/\*\*Profile ID:\*\* `([^`]+)`/)?.[1];
  if (!id) continue;
  design.set(id, {
    promise: section(markdown, "Product promise"),
    motion: section(markdown, "Required motion behavior"),
    layers: bullets(markdown, "Required layers"),
    undesirable: section(markdown, "Must not sound like").split(",").map((v) => v.trim().replace(/\.$/, "")),
    samples: section(markdown, "Sample and source plan"),
    technicalFamily: markdown.match(/\*\*Technical family:\*\* ([^\r\n]+)/)?.[1]?.trim() ?? "unknown",
  });
}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
let profiles;
let configs;
try {
  profiles = (await server.ssrLoadModule("/src/lib/sound/profiles.ts")).SOUND_PROFILES;
  configs = (await server.ssrLoadModule("/src/lib/sound/profile-experience-config.ts")).PROFILE_EXPERIENCE_CONFIG;
} finally {
  await server.close();
}

const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
const v2Ids = new Set(["gt-v8", "racing-v10", "race-car", "rally-car", "flat-six-sport", "american-muscle-v8", "turbo-inline-6", "motorcycle-superbike", "big-twin"]);
const symphonyIds = new Set(profiles.filter((p) => p.id.startsWith("symphony-")).map((p) => p.id));
const worldIds = new Set(profiles.filter((p) => p.id.startsWith("world-")).map((p) => p.id));
const fusionIds = new Set(profiles.filter((p) => p.id.startsWith("fusion-")).map((p) => p.id));

function renderer(id) {
  if (symphonyIds.has(id)) return "Fact: SymphonySynth / procedural development stems";
  if (worldIds.has(id)) return "Fact: WorldSynth / procedural world pack";
  if (fusionIds.has(id)) return "Fact: FusionSynth / machine + music buses";
  if (v2Ids.has(id)) return "Fact: Realism V2 procedural hybrid-capable renderer; Current renderer retained for A/B";
  return "Fact: ImprovedSynth profile strategy; Original renderer retained for A/B";
}

function weakness(id) {
  if (id === "farting-car" || id === "kazoo-kart") return "Fact: virtual drivetrain still resolves through the generic GT V8 fallback; no direct audible regression.";
  if (v2Ids.has(id)) return "Fact: no approved recorded bank ships; realtime worklet and offline fallback excitation are not sample-identical; direct listening remains required.";
  if (symphonyIds.has(id) || worldIds.has(id) || fusionIds.has(id)) return "Fact: no explicit portfolio loudness trim or full replay golden; generated/procedural assets only.";
  return "Fact: procedural-only strategy with no profile-specific recorded assets and no direct full-drive audio golden.";
}

const lines = [
  "# ELCAMOSO profile upgrade matrix",
  "",
  `Generated from the runtime registry on ${new Date().toISOString().slice(0, 10)}. The registry contains **${profiles.length}** selectable profiles. Public IDs, ordering and entitlements are not changed by this matrix.`,
  "",
  "## Evidence boundary",
  "",
  "Cells prefixed **Fact** describe inspected runtime behavior or shipped files. Cells prefixed **Design** are sound-design targets, not claims of vehicle replication. Marketing names are not used to infer topology: an engine layout is stated only when the typed drivetrain/acoustic configuration or the profile specification states it. No public V12 or supercharged profile currently exists; no such topology was invented. No runtime WAV/MP3/OGG/FLAC assets currently ship under `public/`.",
  "",
  "Status `listening verified` is intentionally unused: automated checks and spectral measurements do not establish realism or comfort.",
  "",
  "| ID / display name | Family and intended character | Renderer / assets | Unique acoustic identity (>=3 targets) | RPM/speed and load behavior | Shift / lift-off / regen | Closest profile and required distinction | Evidence-backed weakness | Planned improvement / missing assets | Status | Undesirable traits (>=3) |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
];

for (const profile of profiles) {
  const d = design.get(profile.id);
  const c = configs[profile.id];
  if (!d || !c) throw new Error(`Missing profile documentation or config: ${profile.id}`);
  if (d.layers.length < 3 || d.undesirable.length < 3) throw new Error(`Identity requirements incomplete: ${profile.id}`);
  const neighborId = closest[profile.id];
  const neighborName = profileNames.get(neighborId) ?? neighborId ?? "none";
  const assetFact = profile.id === "american-muscle-v8"
    ? "Fact: typed pilot manifest exists, but all asset paths and approvals remain unknown; procedural fallback active."
    : "Fact: no approved runtime recording ships; procedural source active.";
  const drivetrainFact = profile.drivetrainMode === "virtual-transmission"
    ? `Fact: virtual transmission${profile.drivetrainPersonalityId ? ` via \`${profile.drivetrainPersonalityId}\`` : " via fallback resolution"}; shift phases are simulated, not measured.`
    : "Fact: continuous motion model; no physical gear claim.";
  const regen = c.availableRoles.includes("regen") ? ` Design: regen identity ${c.phases.regenCharacter.toFixed(2)}.` : " Design: no combustion-like regen event.";
  const aspiration = c.aspiration === "turbocharged"
    ? ` Turbo state: simulated boost, ${c.aspirationDynamics.attackSeconds.toFixed(2)} s attack / ${c.aspirationDynamics.decaySeconds.toFixed(2)} s decay; release requires >=${c.aspirationDynamics.minimumReleaseState.toFixed(2)} prior state.`
    : "";
  const plan = `Design: phase mix idle ${c.phases.idleCharacter.toFixed(2)}, accel texture ${c.phases.accelerationTexture.toFixed(2)}, cruise intrusive scale ${c.phases.cruiseIntrusiveScale.toFixed(2)}, release ${c.phases.releaseCharacter.toFixed(2)}; ${c.availableRoles.join("/")} isolation. Missing assets: ${d.samples}`;
  lines.push(
    `| \`${profile.id}\`<br>${inline(profile.name)} | Fact: ${inline(explicitFamily[profile.id] ?? `${d.technicalFamily}; exact topology unspecified`)}.<br>Design: ${inline(d.promise)} | ${renderer(profile.id)}<br>${assetFact} | Design: ${inline(d.layers.join("; "))} | Fact: pitch driver \`${c.pitchDriver}\`; load driver \`${c.loadDriver}\`.<br>Design: ${inline(d.motion)} | ${drivetrainFact}${regen}${aspiration} | Design: **${inline(neighborName)}**; preserve ${inline(d.promise)} rather than converging on the neighbor's layer balance and response. | ${weakness(profile.id)} | ${inline(plan)} | **${c.status}** | Design rejection: ${inline(d.undesirable.join("; "))} |`,
  );
}

lines.push(
  "",
  "## Implementation notes",
  "",
  "- Executable phase, aspiration, variation and role-isolation settings live in `src/lib/sound/profile-experience-config.ts`; prose remains in this matrix and `docs/sound-profiles/`.",
  "- GPS/vehicle speed is measured only when supplied by that source. RPM, gear, engine load, boost, torque demand and motor speed are simulated unless a future telemetry adapter explicitly marks them measured.",
  "- `hybrid` means the integration can blend approved recordings; it does not mean recordings are present or realism has been listening-verified.",
  "- Every profile currently remains procedural in this checkout. Symphony/Fusion `hybrid` source mode refers to generated machine/music composition, not an approved recorded engine bank.",
  "",
);

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${lines.join("\n")}\n`);
console.log(`Wrote ${path.relative(root, output)} with ${profiles.length} profile rows.`);
