import type { DynamicLayerDebugInfo } from "@/lib/sound/dynamic-drive/types";

const STEADY_IDS = new Set([
  "dd-idle",
  "dd-low",
  "dd-mid",
  "dd-high",
  "dd-redline",
  "dd-high-load",
]);

function fmtGain(value: number): string {
  return value.toFixed(3);
}

function fmtHz(value: number): string {
  return value.toFixed(1);
}

function fmtRate(value: number): string {
  return value.toFixed(2);
}

interface DynamicDriveLayerPanelProps {
  layers: DynamicLayerDebugInfo[];
  /** When true, only list layers above the audible threshold. */
  activeOnly?: boolean;
  className?: string;
}

/** Dev panel: Dynamic Drive layer gains and fundamental Hz (not a single playbackRate hack). */
export function DynamicDriveLayerPanel({
  layers,
  activeOnly = false,
  className = "",
}: DynamicDriveLayerPanelProps) {
  if (!layers.length) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>
        Dynamic Drive layers appear when motion-matched audio is active.
      </p>
    );
  }

  const threshold = 0.008;
  const rows = activeOnly ? layers.filter((row) => row.gain >= threshold) : layers;
  const steady = rows.filter((row) => STEADY_IDS.has(row.id));
  const transients = rows.filter((row) => !STEADY_IDS.has(row.id));

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2 pr-4 font-normal">Layer</th>
              <th className="pb-2 pr-4 font-normal">Gain</th>
              <th className="pb-2 pr-4 font-normal">Fundamental Hz</th>
              <th className="pb-2 font-normal">Rate ratio</th>
            </tr>
          </thead>
          <tbody>
            {steady.map((row) => (
              <LayerRow key={row.id} row={row} />
            ))}
            {transients.length > 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="pt-3 pb-1 text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
                >
                  Transients
                </td>
              </tr>
            ) : null}
            {transients.map((row) => (
              <LayerRow key={row.id} row={row} muted />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LayerRow({ row, muted = false }: { row: DynamicLayerDebugInfo; muted?: boolean }) {
  const label = row.id.replace(/^dd-/, "");
  return (
    <tr className={`border-b border-border/60 ${muted ? "text-muted-foreground" : ""}`}>
      <td className="py-2 pr-4 font-mono">{label}</td>
      <td className="py-2 pr-4 tabular-nums">{fmtGain(row.gain)}</td>
      <td className="py-2 pr-4 tabular-nums">{fmtHz(row.fundamentalHz)}</td>
      <td className="py-2 tabular-nums">{fmtRate(row.playbackRate)}</td>
    </tr>
  );
}
