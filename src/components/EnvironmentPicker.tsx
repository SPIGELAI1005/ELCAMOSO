import { ENVIRONMENTS, getEnvironment } from "@/lib/sound/environments";

/**
 * Driving environment selector. Each preset changes the space the sound is
 * heard in and how the layers rebalance while you move.
 */
export function EnvironmentPicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const active = getEnvironment(value);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Environment
        </h3>
        <span className="text-xs text-muted-foreground">{active.name}</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {ENVIRONMENTS.map((env) => (
          <button
            key={env.id}
            onClick={() => onChange(env.id)}
            aria-pressed={env.id === value}
            className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.16em] uppercase transition-colors ${
              env.id === value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {env.name}
          </button>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{active.description}</p>
    </div>
  );
}
