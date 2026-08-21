import { DRIVE_CONTEXTS, type DriveContext } from "@/lib/drive/context";
import type { ProfileRule, ProfileRuleMetric, ProfileRuleOp } from "@/lib/drive/rules";
import { describeProfileRule } from "@/lib/drive/profile-rules";
import { LAYER_KEYS, LAYER_LABELS, type LayerKey } from "@/lib/sound/environments";
import { ENVIRONMENTS } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";

export function ProfileRulesEditor({
  rules,
  snippets,
  onChange,
}: {
  rules: ProfileRule[];
  snippets: SoundSnippet[];
  onChange: (rules: ProfileRule[]) => void;
}) {
  const add = () => {
    const rule: ProfileRule = {
      id: `pr-${Date.now().toString(36)}`,
      enabled: true,
      metric: "speedKmh",
      op: "gt",
      value: 110,
      action: { kind: "mixDelta", layer: "beds", delta: 0.1 },
    };
    onChange([...rules, rule].slice(0, 16));
  };

  const patch = (id: string, next: Partial<ProfileRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...next } : r)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Trigger rules
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Simple IF / THEN for this Sound Profile. Layer changes and snippets stay on-device.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No rules yet.</p>
      ) : (
        <ul className="mt-8 space-y-8">
          {rules.map((rule) => (
            <li key={rule.id} className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">{describeProfileRule(rule)}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  When
                  <select
                    value={rule.metric}
                    onChange={(e) => {
                      const metric = e.target.value as ProfileRuleMetric;
                      patch(rule.id, {
                        metric,
                        value:
                          metric === "context"
                            ? "cruise"
                            : metric === "speedKmh"
                              ? 110
                              : 0.6,
                        op: metric === "context" ? "eq" : "gt",
                      });
                    }}
                    className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                  >
                    <option value="speedKmh">Speed</option>
                    <option value="throttle">Throttle</option>
                    <option value="regen">Regen</option>
                    <option value="context">Motion context</option>
                  </select>
                </label>
                <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  Compare
                  <select
                    value={rule.op}
                    onChange={(e) => patch(rule.id, { op: e.target.value as ProfileRuleOp })}
                    className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                  >
                    {rule.metric === "context" ? (
                      <option value="eq">is</option>
                    ) : (
                      <>
                        <option value="gt">above</option>
                        <option value="lt">below</option>
                      </>
                    )}
                  </select>
                </label>
                {rule.metric === "context" ? (
                  <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    Context
                    <select
                      value={String(rule.value)}
                      onChange={(e) =>
                        patch(rule.id, { value: e.target.value as DriveContext })
                      }
                      className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                    >
                      {DRIVE_CONTEXTS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    Value
                    <input
                      type="number"
                      step={rule.metric === "speedKmh" ? 5 : 0.05}
                      value={typeof rule.value === "number" ? rule.value : 0}
                      onChange={(e) => patch(rule.id, { value: Number(e.target.value) })}
                      className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm outline-none"
                    />
                  </label>
                )}
                <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  Then
                  <select
                    value={rule.action.kind}
                    onChange={(e) => {
                      const kind = e.target.value;
                      if (kind === "playSnippet") {
                        patch(rule.id, {
                          action: {
                            kind: "playSnippet",
                            snippetId: snippets[0]?.id ?? "",
                          },
                        });
                      } else if (kind === "setEnvironment") {
                        patch(rule.id, {
                          action: {
                            kind: "setEnvironment",
                            environmentId: ENVIRONMENTS[0]!.id,
                          },
                        });
                      } else {
                        patch(rule.id, {
                          action: { kind: "mixDelta", layer: "beds", delta: 0.1 },
                        });
                      }
                    }}
                    className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                  >
                    <option value="mixDelta">Layer level</option>
                    <option value="playSnippet">Play snippet</option>
                    <option value="setEnvironment">Environment</option>
                  </select>
                </label>
                {rule.action.kind === "mixDelta" ? (
                  <>
                    <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                      Layer
                      <select
                        value={rule.action.layer}
                        onChange={(e) =>
                          patch(rule.id, {
                            action: {
                              kind: "mixDelta",
                              layer: e.target.value as LayerKey,
                              delta: rule.action.kind === "mixDelta" ? rule.action.delta : 0.1,
                            },
                          })
                        }
                        className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                      >
                        {LAYER_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {LAYER_LABELS[key].name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                      Change
                      <input
                        type="range"
                        min={-0.5}
                        max={0.5}
                        step={0.05}
                        value={rule.action.delta}
                        onChange={(e) =>
                          patch(rule.id, {
                            action: {
                              kind: "mixDelta",
                              layer: rule.action.kind === "mixDelta" ? rule.action.layer : "beds",
                              delta: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-2 slider h-11 w-full"
                      />
                    </label>
                  </>
                ) : null}
                {rule.action.kind === "playSnippet" ? (
                  <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    Snippet
                    <select
                      value={rule.action.snippetId}
                      onChange={(e) =>
                        patch(rule.id, {
                          action: { kind: "playSnippet", snippetId: e.target.value },
                        })
                      }
                      className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                    >
                      {snippets.length === 0 ? (
                        <option value="">Add a snippet in Garage first</option>
                      ) : (
                        snippets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                ) : null}
                {rule.action.kind === "setEnvironment" ? (
                  <label className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    Environment
                    <select
                      value={rule.action.environmentId}
                      onChange={(e) =>
                        patch(rule.id, {
                          action: { kind: "setEnvironment", environmentId: e.target.value },
                        })
                      }
                      className="mt-2 h-11 w-full border-b border-border bg-transparent text-sm text-foreground outline-none"
                    >
                      {ENVIRONMENTS.map((env) => (
                        <option key={env.id} value={env.id}>
                          {env.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
                className="mt-4 h-11 text-[11px] tracking-[0.16em] text-muted-foreground uppercase"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
