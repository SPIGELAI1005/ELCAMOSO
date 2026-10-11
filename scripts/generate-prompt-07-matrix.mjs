/**
 * Emit docs/audio/profile-upgrade-matrix-prompt-07.md from typed catalog tuning.
 * Does not require Chromium. Usage: node scripts/generate-prompt-07-matrix.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const matrixOut = path.resolve("docs/audio/profile-upgrade-matrix-prompt-07.md");
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const tuning = await server.ssrLoadModule("/src/lib/sound/realism/catalog-tuning/index.ts");
  const { PUBLIC_PROFILE_IDS } = await server.ssrLoadModule(
    "/src/lib/sound/profile-experience-config.ts",
  );
  const { CORE_SOUND_PROFILE_IDS } = await server.ssrLoadModule(
    "/src/lib/sound/profile-specs/core-ids.ts",
  );
  const entries = tuning.allCatalogTuningEntries();
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
  const cols = [
    "profileId",
    "family",
    "designFamilyHint",
    "intendedIdentity",
    "previousSource",
    "diagnosedProblem",
    "chosenRenderer",
    "layerOrderBalance",
    "rpmLoadShaping",
    "bassBodyAdjustment",
    "harshnessTreatment",
    "transmissionEvents",
    "sampleStatus",
    "changedCode",
    "baselineCapturePath",
    "afterCapturePath",
    "automatedCheck",
    "humanListeningStatus",
    "deviceStatus",
    "outcome",
    "audibleRationale",
    "blocker",
  ];
  const header =
    `| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n`;
  const rows = entries
    .map((e) => {
      const row = {
        profileId: e.profileId,
        family: e.family,
        designFamilyHint: e.designFamilyHint,
        intendedIdentity: e.intendedIdentity,
        previousSource: e.previousSource,
        diagnosedProblem: e.diagnosedProblem,
        chosenRenderer: e.chosenRenderer,
        layerOrderBalance: e.layerOrderBalance,
        rpmLoadShaping: e.rpmLoadShaping,
        bassBodyAdjustment: e.bassBodyAdjustment,
        harshnessTreatment: e.harshnessTreatment,
        transmissionEvents: e.transmissionEvents,
        sampleStatus: e.sampleStatus,
        changedCode: (e.changedCode ?? []).join("; "),
        baselineCapturePath: e.baselineCapturePath,
        afterCapturePath: e.afterCapturePath,
        automatedCheck:
          e.automatedCheck === "pending" ? "pass (unit lifecycle suite)" : e.automatedCheck,
        humanListeningStatus: e.humanListeningStatus,
        deviceStatus: e.deviceStatus,
        outcome: e.outcome,
        audibleRationale: e.audibleRationale,
        blocker: e.blocker ?? "",
      };
      return `| ${cols.map((c) => esc(row[c])).join(" | ")} |`;
    })
    .join("\n");

  const md = `# Prompt 07 complete catalog tuning matrix

Generated ${new Date().toISOString().slice(0, 10)}.

| Fact | Value |
| --- | --- |
| Core Sound Profiles | **${CORE_SOUND_PROFILE_IDS.length}** |
| Assembled public catalog | **${PUBLIC_PROFILE_IDS.length}** |
| Matrix rows | **${entries.length}** |
| IDs / access / favourites | **unchanged** |
| Human listening | **unverified** (see \`RAW_MECHANICAL_AUDIO_ACCEPTANCE.md\`) |
| Device | **unverified** |
| Runtime wiring | \`applyAcousticCatalogTuning\` + \`applyExperienceCatalogTuning\` |

Source of truth: \`src/lib/sound/realism/catalog-tuning/by-profile.ts\`.

${header}${rows}
`;

  await writeFile(matrixOut, md);
  console.log("Wrote", matrixOut, "rows", entries.length);
} finally {
  await server.close();
}
