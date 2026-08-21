import {
  DEFAULT_LAYER_MIX,
  LAYER_KEYS,
  LAYER_LABELS,
  type LayerKey,
  type LayerMix,
  type LayerSetting,
} from "@/lib/sound/environments";

/**
 * Per-layer mixer: level, tone tilt and how much of each layer is sent into
 * the driving environment, so every texture can be dialled to taste.
 */
export function LayerMixer({
  mix,
  onChange,
  className = "",
}: {
  mix: LayerMix;
  onChange: (mix: LayerMix) => void;
  className?: string;
}) {
  const setLayer = (key: LayerKey, next: Partial<LayerSetting>) =>
    onChange({ ...mix, [key]: { ...mix[key], ...next } });

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Layer mixer
        </h3>
        <button
          onClick={() => onChange(DEFAULT_LAYER_MIX)}
          className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Reset
        </button>
      </div>
      <div className="mt-8 grid gap-10 sm:grid-cols-3">
        {LAYER_KEYS.map((key) => {
          const setting = mix[key];
          const label = LAYER_LABELS[key];
          return (
            <div key={key}>
              <p className="text-sm">{label.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">{label.hint}</p>
              <Slide
                id={`mix-${key}-volume`}
                label="Level"
                value={setting.volume}
                min={0}
                max={2}
                suffix="x"
                onChange={(v) => setLayer(key, { volume: v })}
              />
              <Slide
                id={`mix-${key}-tone`}
                label="Tone"
                value={setting.tone}
                min={0}
                max={2}
                suffix="x"
                onChange={(v) => setLayer(key, { tone: v })}
              />
              <Slide
                id={`mix-${key}-wet`}
                label="Space"
                value={setting.wet}
                min={0}
                max={1}
                suffix=""
                onChange={(v) => setLayer(key, { wet: v })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Slide({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.toFixed(2)}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 slider h-11 w-full"
      />
    </div>
  );
}
