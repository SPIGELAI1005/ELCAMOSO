import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { useSettings } from "@/lib/drive/useSettings";
import {
  clearStoredSettings,
  exportSettingsFile,
  getProfileGain,
  importSettingsFile,
  resetOnboarding,
  restoreRecommended,
  type ImportMode,
} from "@/lib/drive/settings";
import { CabinEqPanel } from "@/components/CabinEqPanel";
import { DEFAULT_SHIFT_FEEL } from "@/lib/drive/types-extra";
import { t, type Locale } from "@/lib/i18n";
import { downloadBlob, renderToAudio } from "@/lib/sound/render";
import { loadGarageFn, syncGarageFn } from "@/lib/cloud/server-fns";
import type { AutoRule, AutoRulesMode } from "@/lib/drive/rules";
import { DRIVE_CONTEXTS } from "@/lib/drive/context";
import { DiagnosticsPanel } from "@/components/DiagnosticsPanel";
import { DynamicDriveTrialSettings } from "@/components/DynamicDriveTrialSettings";
import { BillingSettingsPanel } from "@/components/BillingSettingsPanel";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { TeslaVehicleConnect } from "@/components/TeslaVehicleConnect";
import { hapticsSupported } from "@/lib/drive/useHaptics";
import { getProfile } from "@/lib/sound/profiles";
import { getSession } from "@/lib/drive/session";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/settings")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { workspace?: string; tesla?: string; teslaMsg?: string; billing?: string } => {
    const workspace = typeof search["workspace"] === "string" ? search["workspace"] : undefined;
    const tesla = typeof search["tesla"] === "string" ? search["tesla"] : undefined;
    const teslaMsg = typeof search["teslaMsg"] === "string" ? search["teslaMsg"] : undefined;
    const billing = typeof search["billing"] === "string" ? search["billing"] : undefined;
    return {
      ...(workspace ? { workspace } : {}),
      ...(tesla ? { tesla } : {}),
      ...(teslaMsg ? { teslaMsg } : {}),
      ...(billing ? { billing } : {}),
    };
  },
  component: Settings,
  head: () => createSeoHeadFromPath("/settings"),
});

type Workspace = {
  id: string;
  step: string;
  title: string;
  hint: string;
  keywords: string;
};

const WORKSPACES: Workspace[] = [
  {
    id: "plan",
    step: "00",
    title: "Plan",
    hint: "Account, billing, Drive+",
    keywords:
      "plan subscription drive plus billing manage account sign in upgrade renewal cancel trial preview",
  },
  {
    id: "sound",
    step: "01",
    title: "Sound",
    hint: "Volume, balance, cabin",
    keywords: "sound volume balance profile cabin eq gear shift clip studio garage",
  },
  {
    id: "driving",
    step: "02",
    title: "Driving",
    hint: "Smart switching, ducking",
    keywords: "driving drive smart switch auto rule suggest ducking call",
  },
  {
    id: "sensors",
    step: "03",
    title: "Sensors",
    hint: "Location, Motion, calibrate",
    keywords: "sensors location motion calibrate sensor demo latency reduced haptic drive",
  },
  {
    id: "privacy",
    step: "04",
    title: "Privacy",
    hint: "Insights, your drive",
    keywords: "privacy analytics insights drive data",
  },
  {
    id: "about",
    step: "05",
    title: "About",
    hint: "Language, units, legal",
    keywords: "about language units legal impressum privacy cookies terms",
  },
  {
    id: "advanced",
    step: "06",
    title: "Advanced",
    hint: "Diagnostics, backup, cloud",
    keywords:
      "advanced diagnostics debug panel backup export import transfer recovery onboarding clear cloud sync",
  },
];

function Settings() {
  const { settings, update, loaded, loadReport } = useSettings();
  const { workspace, tesla, teslaMsg, billing } = Route.useSearch();
  const navigate = useNavigate();
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [canVibrate, setCanVibrate] = useState(true);
  useEffect(() => setCanVibrate(hapticsSupported()), []);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importMode = useRef<ImportMode>("merge");
  const [transferNote, setTransferNote] = useState<string | null>(null);
  const [transferDetails, setTransferDetails] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const profileGain = getProfileGain(settings, settings.profileId);
  const q = query.trim().toLowerCase();
  const virtualTx = getProfile(settings.profileId).drivetrainMode === "virtual-transmission";

  const visible = WORKSPACES.filter(
    (w) =>
      !q ||
      w.title.toLowerCase().includes(q) ||
      w.hint.toLowerCase().includes(q) ||
      w.keywords.includes(q),
  );

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const report = await importSettingsFile(file, importMode.current);
      setTransferNote(
        report.mode === "merge"
          ? "Backup merged into your current setup."
          : "Backup imported and your previous setup was replaced.",
      );
      const details = [
        `Backup format v${report.version}.`,
        `${report.soundsAdded} sound${report.soundsAdded === 1 ? "" : "s"} added` +
          (report.soundsSkipped
            ? `, ${report.soundsSkipped} already here and kept as they were.`
            : "."),
        report.favouritesAdded
          ? `${report.favouritesAdded} favourite${report.favouritesAdded === 1 ? "" : "s"} added.`
          : "",
        report.tuningsMerged
          ? `${report.tuningsMerged} motion tuning set${report.tuningsMerged === 1 ? "" : "s"} merged.`
          : "",
        ...report.migrations,
        ...report.repairs.map((r) => `Repaired ${r.field}: ${r.detail}`),
      ].filter(Boolean);
      setTransferDetails(details);
    } catch (error) {
      setTransferNote(
        error instanceof Error
          ? error.message
          : "That file could not be read as an ELCAMOSO backup.",
      );
      setTransferDetails([]);
    }
  };

  const billingFlash = billing === "success" ? "success" : billing === "cancel" ? "cancel" : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
        <h1 className="text-3xl font-light">Settings</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Open a group to change sound, driving, sensors, privacy or about.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(settings.language, "settings.search")}
          aria-label={t(settings.language, "settings.search")}
          className="mt-8 h-11 w-full border-b border-border bg-transparent text-sm outline-none focus:border-foreground"
        />
        <button
          type="button"
          onClick={() => restoreRecommended()}
          className="mt-5 h-11 text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
        >
          {t(settings.language, "settings.restore")}
        </button>

        <Accordion
          type="single"
          collapsible
          defaultValue={workspace ?? "sound"}
          className="mt-8 border-t border-border"
        >
          {visible.map((workspace) => (
            <AccordionItem key={workspace.id} value={workspace.id} className="border-border">
              <AccordionTrigger className="py-6 hover:no-underline">
                <WorkspaceLabel
                  step={workspace.step}
                  title={workspace.title}
                  hint={workspace.hint}
                />
              </AccordionTrigger>
              <AccordionContent className="pb-10">
                {workspace.id === "plan" ? <PlanWorkspace billingFlash={billingFlash} /> : null}
                {workspace.id === "sound" ? (
                  <SoundWorkspace
                    settings={settings}
                    update={update}
                    profileGain={profileGain}
                    virtualTx={virtualTx}
                  />
                ) : null}
                {workspace.id === "driving" ? (
                  <DriveWorkspace settings={settings} update={update} />
                ) : null}
                {workspace.id === "sensors" ? (
                  <SensorsWorkspace
                    settings={settings}
                    update={update}
                    canVibrate={canVibrate}
                    teslaFlash={tesla ?? null}
                    teslaFlashMessage={teslaMsg ?? null}
                  />
                ) : null}
                {workspace.id === "privacy" ? (
                  <PrivacyWorkspace settings={settings} update={update} />
                ) : null}
                {workspace.id === "about" ? (
                  <AboutWorkspace settings={settings} update={update} />
                ) : null}
                {workspace.id === "advanced" ? (
                  <AdvancedWorkspace
                    settings={settings}
                    update={update}
                    loaded={loaded}
                    loadReport={loadReport}
                    navigate={navigate}
                    fileRef={fileRef}
                    importMode={importMode}
                    handleImport={handleImport}
                    transferNote={transferNote}
                    transferDetails={transferDetails}
                    recoveryNote={recoveryNote}
                    setRecoveryNote={setRecoveryNote}
                  />
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {!visible.length ? (
          <p className="mt-10 text-sm text-muted-foreground">No settings match that search.</p>
        ) : null}
      </div>
    </main>
  );
}

function WorkspaceLabel({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
      <span className="text-[10px] tracking-[0.28em] text-muted-foreground tabular-nums">
        {step}
      </span>
      <span className="text-base font-light tracking-normal normal-case">{title}</span>
      <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
        {hint}
      </span>
    </span>
  );
}

function SoundWorkspace({
  settings,
  update,
  profileGain,
  virtualTx,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
  profileGain: number;
  virtualTx: boolean;
}) {
  return (
    <div className="space-y-12">
      <Block title="Sound Volume" value={`${Math.round(settings.volume * 100)}`}>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
          className="mt-5 slider h-11 w-full"
          aria-label="Sound Volume"
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Master level for every profile. A limiter keeps sudden peaks in check without flattening
          the dynamics.
        </p>
      </Block>

      <Block title="Profile balance" value={`${profileGain.toFixed(2)}x`}>
        <input
          id="settings-profile-gain"
          type="range"
          min={0.4}
          max={1.6}
          step={0.05}
          value={profileGain}
          onChange={(e) =>
            update({
              profileGain: {
                ...settings.profileGain,
                [settings.profileId]: Number(e.target.value),
              },
            })
          }
          className="mt-5 slider h-11 w-full"
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Applies to {getProfile(settings.profileId).name} only.
        </p>
      </Block>

      <Block title="Sound Profile">
        <p className="mt-2 text-sm text-muted-foreground">
          {getProfile(settings.profileId).name} ·{" "}
          <Link to="/sounds" className="text-foreground underline underline-offset-4">
            Change
          </Link>
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/studio"
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Studio
          </Link>
          <Link
            to="/garage"
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Garage
          </Link>
        </div>
      </Block>

      <CabinEqPanel value={settings.cabinEq} onChange={(cabinEq) => update({ cabinEq })} />

      {virtualTx ? (
        <PremiumFeatureGate
          context="dynamic_drive"
          entitlement="virtual_transmission"
          promptTitle="Gear-shift feel"
        >
          <Block title="Gear-shift feel">
            <p className="mt-2 text-sm text-muted-foreground">
              For Sound Profiles with gear shifts.
            </p>
            <label className="mt-6 block text-sm" htmlFor="shift-ms">
              Shift time
            </label>
            <input
              id="shift-ms"
              type="range"
              min={40}
              max={400}
              value={settings.shiftFeel.shiftMs}
              onChange={(e) =>
                update({ shiftFeel: { ...settings.shiftFeel, shiftMs: Number(e.target.value) } })
              }
              aria-label="Shift time"
              className="mt-3 slider h-11 w-full"
            />
            <label className="mt-6 block text-sm" htmlFor="torque-dip">
              Torque dip
            </label>
            <input
              id="torque-dip"
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={settings.shiftFeel.torqueDip}
              onChange={(e) =>
                update({
                  shiftFeel: { ...settings.shiftFeel, torqueDip: Number(e.target.value) },
                })
              }
              aria-label="Torque dip"
              className="mt-3 slider h-11 w-full"
            />
            <label className="mt-6 block text-sm" htmlFor="rev-match">
              Rev match
            </label>
            <input
              id="rev-match"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.shiftFeel.revMatch}
              onChange={(e) =>
                update({
                  shiftFeel: { ...settings.shiftFeel, revMatch: Number(e.target.value) },
                })
              }
              aria-label="Rev match"
              className="mt-3 slider h-11 w-full"
            />
            <button
              type="button"
              className="mt-4 text-[11px] uppercase text-muted-foreground hover:text-foreground"
              onClick={() => update({ shiftFeel: DEFAULT_SHIFT_FEEL })}
            >
              Reset shift feel
            </button>
          </Block>
        </PremiumFeatureGate>
      ) : null}

      <Block title="Render a clip">
        <p className="mt-2 text-sm text-muted-foreground">
          A 15 second simulated ramp through the current Sound Profile, downloaded as WAV.
        </p>
        <button
          type="button"
          className="mt-5 h-11 rounded-full border border-border px-5 text-[11px] uppercase"
          onClick={async () => {
            const blob = await renderToAudio({ profileId: settings.profileId, duration: 15 });
            downloadBlob(blob, "elcamoso-clip.wav");
          }}
        >
          Download 15s clip
        </button>
      </Block>
    </div>
  );
}

function SensorsWorkspace({
  settings,
  update,
  canVibrate,
  teslaFlash,
  teslaFlashMessage,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
  canVibrate: boolean;
  teslaFlash: string | null;
  teslaFlashMessage: string | null;
}) {
  return (
    <div className="space-y-12">
      <TeslaVehicleConnect flash={teslaFlash} flashMessage={teslaFlashMessage} />

      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-base">Motion calibration</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.calibratedAt
              ? `Sensitivity ${settings.motionSensitivity.toFixed(2)}x, calibrated ${new Date(settings.calibratedAt).toLocaleDateString()}.`
              : "Not calibrated yet. A quick check tunes how strongly O ))) reacts on this device."}
          </p>
        </div>
        <Link
          to="/calibrate"
          className="shrink-0 self-center rounded-full border border-border px-6 py-3 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Calibrate
        </Link>
      </div>

      <RowToggle
        title="Driving Sensors"
        hint="Use real speed from this device. Turn off to simulate motion while standing still."
        checked={!settings.demoMotion}
        onChange={(v) => update({ demoMotion: !v })}
        label="Driving Sensors"
      />

      <RowToggle
        title="Demo Motion"
        hint="Simulate movement to hear a profile without sensors."
        checked={settings.demoMotion}
        onChange={(v) => update({ demoMotion: v })}
        label="Demo Motion"
      />

      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-base">Demo Drive</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Preview with manual throttle, acceleration and regen.
          </p>
        </div>
        <Link
          to="/demo"
          className="shrink-0 self-center rounded-full border border-border px-6 py-3 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Open
        </Link>
      </div>

      <PremiumFeatureGate context="advanced_controls">
        <Block title="Match sound to motion">
          <p className="mt-2 text-sm text-muted-foreground">
            On Bluetooth headphones the sound can lag. Lookahead keeps the feel locked. 0 to 250 ms.
          </p>
          <input
            type="range"
            min={0}
            max={250}
            step={5}
            value={settings.latencyCompMs}
            aria-label="Latency match"
            onChange={(e) => update({ latencyCompMs: Number(e.target.value) })}
            className="mt-5 slider h-11 w-full"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>{Math.round(settings.latencyCompMs)} ms</span>
            <button
              type="button"
              className="h-11 text-[11px] tracking-[0.16em] uppercase hover:text-foreground"
              onClick={() => {
                const perf = getSession().snapshot().perf;
                const measured = Math.min(
                  250,
                  Math.max(0, Math.round(perf.outputLatencyMs || perf.baseLatencyMs || 80)),
                );
                update({ latencyCompMs: measured });
              }}
            >
              Measure from last Listen
            </button>
          </div>
        </Block>
      </PremiumFeatureGate>

      <RowToggle
        title="Haptic feedback"
        hint={`Optional vibration that follows throttle and regen.${canVibrate ? "" : " This device does not support vibration."}`}
        checked={settings.haptics}
        onChange={(v) => update({ haptics: v })}
        label="Haptic feedback"
      />

      <RowToggle
        title="Reduced Motion"
        hint="Calmer O ))) feedback - the mark responds with light instead of movement."
        checked={settings.reducedMotion}
        onChange={(v) => update({ reducedMotion: v })}
        label="Reduced Motion"
      />
    </div>
  );
}

function DriveWorkspace({
  settings,
  update,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
}) {
  return (
    <div className="space-y-12">
      <Block title="Smart Sound Profile switching">
        <p className="mt-2 text-sm text-muted-foreground">
          Switch by speed band, hour, drive minutes, or Motion context. Hold on Drive keeps your
          current Sound Profile.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {(
            [
              { id: "off", label: "Off" },
              { id: "suggest", label: "Suggest" },
              { id: "auto", label: "Auto" },
            ] as { id: AutoRulesMode; label: string }[]
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() =>
                update({
                  autoRulesMode: mode.id,
                  autoRulesEnabled: mode.id !== "off",
                })
              }
              className={`h-11 rounded-full border px-5 text-[11px] tracking-[0.16em] uppercase ${
                settings.autoRulesMode === mode.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
            onClick={() => {
              const rule: AutoRule = {
                id: `rule-${Date.now()}`,
                enabled: true,
                profileId: settings.profileId,
                when: { kind: "speedBand", minKmh: 0, maxKmh: 50 },
              };
              update({ autoRules: [...settings.autoRules, rule].slice(0, 12) });
            }}
          >
            Add speed-band rule
          </button>
          <button
            type="button"
            className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
            onClick={() => {
              const rule: AutoRule = {
                id: `rule-${Date.now()}`,
                enabled: true,
                profileId: settings.profileId,
                when: { kind: "context", context: "cruise" },
              };
              update({ autoRules: [...settings.autoRules, rule].slice(0, 12) });
            }}
          >
            Add Motion context rule
          </button>
        </div>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {settings.autoRules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3">
              <span>
                {formatAutoRuleWhen(rule)} → {getProfile(rule.profileId).name}
              </span>
              <button
                type="button"
                className="h-11 px-3 text-[11px] uppercase"
                onClick={() =>
                  update({ autoRules: settings.autoRules.filter((r) => r.id !== rule.id) })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Calls and ducking">
        <p className="mt-2 text-sm text-muted-foreground">
          On an audio interrupt, ELCAMOSO fades to a quiet duck, then restores when audio can run
          again. iOS Safari still needs a user gesture to start audio.
        </p>
      </Block>
    </div>
  );
}

function PrivacyWorkspace({
  settings,
  update,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
}) {
  return (
    <div className="space-y-12">
      <RowToggle
        title="Usage insights"
        hint="Optional counts with an anonymous install id. No Motion, GPS or audio."
        checked={settings.analyticsEnabled}
        onChange={(v) => update({ analyticsEnabled: v })}
        label="Usage insights"
      />

      <Block title="Your drive stays yours.">
        <p className="mt-2 text-sm text-muted-foreground">
          Speed and motion data are processed on this device. ELCAMOSO does not upload your driving
          route in this MVP.
        </p>
      </Block>
    </div>
  );
}

function PlanWorkspace({ billingFlash }: { billingFlash: "success" | "cancel" | null }) {
  return (
    <div className="space-y-12">
      <Block title="Your plan">
        <p className="mt-2 text-sm text-muted-foreground">Plan status and Dynamic Drive preview.</p>
        <div className="mt-4">
          <BillingSettingsPanel billingFlash={billingFlash} />
        </div>
      </Block>
    </div>
  );
}

function AboutWorkspace({
  settings,
  update,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
}) {
  return (
    <div className="space-y-12">
      <Block title={t(settings.language, "settings.language")}>
        <div className="mt-4 flex gap-2">
          {(["en", "de", "ro"] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => update({ language: code })}
              aria-pressed={settings.language === code}
              className={`h-11 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                settings.language === code
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </Block>

      <Block title={t(settings.language, "settings.units")}>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => update({ units: "metric" })}
            aria-pressed={settings.units === "metric"}
            className={`h-11 rounded-full border px-4 text-[11px] uppercase ${
              settings.units === "metric"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground"
            }`}
          >
            Metric
          </button>
          <button
            type="button"
            onClick={() => update({ units: "imperial" })}
            aria-pressed={settings.units === "imperial"}
            className={`h-11 rounded-full border px-4 text-[11px] uppercase ${
              settings.units === "imperial"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground"
            }`}
          >
            Imperial
          </button>
        </div>
      </Block>

      <Block title="ELCAMOSO">
        <p className="mt-2 text-sm text-muted-foreground">Your EV. Your Sound.</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            to="/about"
            className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            About
          </Link>
          <Link
            to="/legal/privacy"
            className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            to="/legal/impressum"
            className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Impressum
          </Link>
          <Link
            to="/legal/cookies"
            className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Cookies
          </Link>
          <Link
            to="/legal/terms"
            className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Terms
          </Link>
        </div>
      </Block>
    </div>
  );
}

function AdvancedWorkspace({
  settings,
  update,
  loaded,
  loadReport,
  navigate,
  fileRef,
  importMode,
  handleImport,
  transferNote,
  transferDetails,
  recoveryNote,
  setRecoveryNote,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: ReturnType<typeof useSettings>["update"];
  loaded: boolean;
  loadReport: ReturnType<typeof useSettings>["loadReport"];
  navigate: ReturnType<typeof useNavigate>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  importMode: React.MutableRefObject<ImportMode>;
  handleImport: (file: File | undefined) => Promise<void>;
  transferNote: string | null;
  transferDetails: string[];
  recoveryNote: string | null;
  setRecoveryNote: (v: string | null) => void;
}) {
  return (
    <div className="space-y-12">
      <DynamicDriveTrialSettings settings={settings} />
      <PremiumFeatureGate context="dynamic_drive">
        <RowToggle
          title="Motion character"
          hint="Gears and response follow your driving. Off keeps a simpler speed-based feel."
          checked={settings.dynamicDrive}
          onChange={(v) => update({ dynamicDrive: v })}
          label="Motion-matched sound"
        />
      </PremiumFeatureGate>
      <RowToggle
        title="Diagnostics panel"
        hint="Shows the last storage load result and landing flags."
        checked={settings.devPanel}
        onChange={(v) => update({ devPanel: v, ...(v ? {} : { debugDriveDiagnostics: false }) })}
        label="Diagnostics panel"
      />
      {settings.devPanel ? (
        <>
          <RowToggle
            title="Drive debug mode"
            hint="Developer overlay on Drive: timings, road-test HUD, and export. Never shown unless this is on (or ?debug=1 / ?roadTest=1 with Diagnostics panel)."
            checked={settings.debugDriveDiagnostics}
            onChange={(v) => update({ debugDriveDiagnostics: v })}
            label="Drive debug diagnostics"
          />
          <DiagnosticsPanel settings={settings} loadReport={loadReport} loaded={loaded} />
          {import.meta.env.DEV ? (
            <p className="text-sm text-muted-foreground">
              <Link to="/debug" className="underline underline-offset-4 hover:text-foreground">
                Open sound debug harness
              </Link>{" "}
              for Original / Improved A/B, motion scenarios and layer solo.{" "}
              <Link
                to="/debug/diagnostics"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Drive diagnostics
              </Link>{" "}
              for live fusion and network export.{" "}
              <Link
                to="/debug/billing"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Billing admin
              </Link>{" "}
              for subscription lookup and Stripe re-sync.
            </p>
          ) : null}
        </>
      ) : null}

      <Block title="Transfer">
        <p className="mt-2 text-sm text-muted-foreground">
          Export sounds, tuning and drive settings, then import on another device.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => exportSettingsFile()}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => {
              importMode.current = "merge";
              fileRef.current?.click();
            }}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Import and merge
          </button>
          <button
            type="button"
            onClick={() => {
              importMode.current = "replace";
              fileRef.current?.click();
            }}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
          >
            Import and replace
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import settings file"
            onChange={(e) => {
              void handleImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {transferNote ? <p className="mt-4 text-sm text-muted-foreground">{transferNote}</p> : null}
        {transferDetails.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {transferDetails.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </Block>

      <Block title="ELCAMOSO Cloud">
        <p className="mt-2 text-sm text-muted-foreground">
          Opt-in sync for Garage, playlists and settings. Motion stays on this device unless you
          enable drive history.
        </p>
        <div className="mt-5">
          <Toggle
            checked={settings.cloudEnabled}
            onChange={(v) =>
              update({
                cloudEnabled: v,
                cloudAccountId: v
                  ? (settings.cloudAccountId ?? `local-${Date.now()}`)
                  : settings.cloudAccountId,
              })
            }
            label="ELCAMOSO Cloud"
          />
        </div>
        <RowToggle
          title="Include drive history"
          hint="Only when syncing. Raw GPS is never sent."
          checked={settings.includeDriveHistory}
          onChange={(v) => update({ includeDriveHistory: v })}
          label="Include drive history"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="h-11 rounded-full border border-border px-5 text-[11px] uppercase"
            onClick={async () => {
              if (!settings.cloudAccountId) return;
              await syncGarageFn({
                data: {
                  accountId: settings.cloudAccountId,
                  updatedAt: settings.updatedAt,
                  settings: settings.includeDriveHistory
                    ? settings
                    : {
                        customSounds: settings.customSounds,
                        playlists: settings.playlists,
                        favourites: settings.favourites,
                        environmentId: settings.environmentId,
                        layerMix: settings.layerMix,
                        cabinEq: settings.cabinEq,
                      },
                },
              });
            }}
          >
            Sync now
          </button>
          <button
            type="button"
            className="h-11 rounded-full border border-border px-5 text-[11px] uppercase"
            onClick={async () => {
              if (!settings.cloudAccountId) return;
              const doc = await loadGarageFn({ data: { accountId: settings.cloudAccountId } });
              if (doc?.settings) update(doc.settings);
            }}
          >
            Load cloud
          </button>
        </div>
      </Block>

      <Block title="Setup and recovery">
        <p className="mt-2 text-sm text-muted-foreground">
          Run guided setup again, or clear saved data if the app gets stuck.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              resetOnboarding();
              setRecoveryNote("Onboarding reset. Starting setup again.");
              void navigate({ to: "/onboarding" });
            }}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Reset onboarding
          </button>
          <button
            type="button"
            onClick={() => {
              resetOnboarding();
              setRecoveryNote("Onboarding state cleared. You can set it up later.");
            }}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Clear onboarding state
          </button>
          <button
            type="button"
            onClick={() => {
              clearStoredSettings();
              setRecoveryNote("All saved data cleared on this device.");
            }}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Clear all saved data
          </button>
          <Link
            to="/drive"
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
          >
            Go to Drive
          </Link>
        </div>
        {recoveryNote ? <p className="mt-4 text-sm text-muted-foreground">{recoveryNote}</p> : null}
      </Block>
    </div>
  );
}

function Block({
  title,
  value,
  children,
}: {
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-base">{title}</p>
        {value ? <p className="text-sm text-muted-foreground tabular-nums">{value}</p> : null}
      </div>
      {children}
    </div>
  );
}

function RowToggle({
  title,
  hint,
  checked,
  onChange,
  label,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div>
        <p className="text-base">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function formatAutoRuleWhen(rule: AutoRule): string {
  const when = rule.when;
  if (when.kind === "speedBand") return `${when.minKmh}-${when.maxKmh} km/h`;
  if (when.kind === "hour") return `Hours ${when.start}-${when.end}`;
  if (when.kind === "driveMinutes") return `After ${when.min} min`;
  if (when.kind === "context") {
    const name = DRIVE_CONTEXTS.find((c) => c.id === when.context)?.name ?? when.context;
    return `Motion ${name}`;
  }
  return "Rule";
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 shrink-0 rounded-full border border-border transition-colors ${
        checked ? "bg-foreground" : "bg-transparent"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full transition-transform ${
          checked ? "translate-x-6 bg-background" : "translate-x-1 bg-muted-foreground"
        }`}
      />
    </button>
  );
}
