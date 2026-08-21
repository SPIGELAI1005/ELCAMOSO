import type { DriveContext } from "@/lib/drive/context";
import type { LayerKey } from "@/lib/sound/environments";

export type AutoRulesMode = "off" | "suggest" | "auto";

export type RuleWhen =
  | { kind: "speedBand"; minKmh: number; maxKmh: number }
  | { kind: "hour"; start: number; end: number }
  | { kind: "driveMinutes"; min: number }
  | { kind: "context"; context: DriveContext };

export interface AutoRule {
  id: string;
  enabled: boolean;
  profileId: string;
  when: RuleWhen;
}

export type ProfileRuleMetric = "speedKmh" | "throttle" | "regen" | "context";

export type ProfileRuleOp = "gt" | "lt" | "eq";

export type ProfileRuleAction =
  | { kind: "mixDelta"; layer: LayerKey; delta: number }
  | { kind: "playSnippet"; snippetId: string }
  | { kind: "setEnvironment"; environmentId: string };

export interface ProfileRule {
  id: string;
  enabled: boolean;
  metric: ProfileRuleMetric;
  op: ProfileRuleOp;
  /** For speed/throttle/regen: numeric threshold. For context: DriveContext id. */
  value: number | DriveContext;
  action: ProfileRuleAction;
}

export function matchRule(
  rules: AutoRule[],
  kmh: number,
  hour: number,
  driveMinutes: number,
  context: DriveContext,
): string | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const w = rule.when;
    if (w.kind === "speedBand" && kmh >= w.minKmh && kmh < w.maxKmh) return rule.profileId;
    if (w.kind === "hour") {
      if (w.start <= w.end && hour >= w.start && hour < w.end) return rule.profileId;
      if (w.start > w.end && (hour >= w.start || hour < w.end)) return rule.profileId;
    }
    if (w.kind === "driveMinutes" && driveMinutes >= w.min) return rule.profileId;
    if (w.kind === "context" && w.context === context) return rule.profileId;
  }
  return null;
}

export function ruleConditionMet(
  rule: ProfileRule,
  opts: { kmh: number; throttle: number; regen: number; context: DriveContext },
): boolean {
  if (!rule.enabled) return false;
  if (rule.metric === "context") {
    return rule.op === "eq"
      ? opts.context === rule.value
      : rule.op === "lt"
        ? opts.context !== rule.value
        : opts.context === rule.value;
  }
  const actual =
    rule.metric === "speedKmh"
      ? opts.kmh
      : rule.metric === "throttle"
        ? opts.throttle
        : opts.regen;
  const target = typeof rule.value === "number" ? rule.value : 0;
  if (rule.op === "gt") return actual > target;
  if (rule.op === "lt") return actual < target;
  return Math.abs(actual - target) < 0.02;
}
