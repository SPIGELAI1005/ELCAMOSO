import { CABIN_EQ_PRESETS, type CabinEq } from "@/lib/drive/types-extra";

export function CabinEqPanel({
  value,
  onChange,
}: {
  value: CabinEq;
  onChange: (next: CabinEq) => void;
}) {
  return (
    <div>
      <p className="text-base">Cabin EQ</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Three bands after the layer mix, before the space. Use Phone speakers when listening on a
        handset.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {CABIN_EQ_PRESETS.map((preset) => {
          const active =
            preset.eq.low === value.low &&
            preset.eq.mid === value.mid &&
            preset.eq.high === value.high;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              aria-pressed={active}
              onClick={() => onChange({ ...preset.eq })}
              className={`h-9 rounded-full border px-3 text-[10px] tracking-[0.14em] uppercase ${
                active
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <EqSlider
        id="eq-low"
        label="Low"
        value={value.low}
        onChange={(low) => onChange({ ...value, low })}
      />
      <EqSlider
        id="eq-mid"
        label="Mid"
        value={value.mid}
        onChange={(mid) => onChange({ ...value, mid })}
      />
      <EqSlider
        id="eq-high"
        label="High"
        value={value.high}
        onChange={(high) => onChange({ ...value, high })}
      />
    </div>
  );
}

function EqSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">{value.toFixed(1)} dB</span>
      </div>
      <input
        id={id}
        type="range"
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Cabin EQ ${label}`}
        className="mt-3 slider h-11 w-full"
      />
    </div>
  );
}
