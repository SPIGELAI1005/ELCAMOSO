import { ruleConditionMet, type ProfileRule } from "@/lib/drive/rules";
import type { DriveContext } from "@/lib/drive/context";
import {
  DEFAULT_LAYER_MIX,
  LAYER_KEYS,
  type LayerKey,
  type LayerMix,
} from "@/lib/sound/environments";

export interface ProfileRuleEvalInput {
  rules: ProfileRule[];
  kmh: number;
  throttle: number;
  regen: number;
  context: DriveContext;
  mix: LayerMix;
  /** snippet ids already fired this hold (edge latch) */
  latched: Set<string>;
}

export interface ProfileRuleEvalResult {
  mix: LayerMix;
  environmentId: string | null;
  snippetIds: string[];
  /** updated latch set */
  latched: Set<string>;
}

/** Apply matching IF/THEN rules. Mix deltas clamp to 0..2. Snippets edge-fire once per latch. */
export function evaluateProfileRules(input: ProfileRuleEvalInput): ProfileRuleEvalResult {
  let mix = cloneMix(input.mix);
  let environmentId: string | null = null;
  const snippetIds: string[] = [];
  const latched = new Set(input.latched);

  for (const rule of input.rules) {
    const met = ruleConditionMet(rule, {
      kmh: input.kmh,
      throttle: input.throttle,
      regen: input.regen,
      context: input.context,
    });
    if (!met) {
      if (rule.action.kind === "playSnippet") latched.delete(rule.id);
      continue;
    }
    if (rule.action.kind === "mixDelta") {
      const layer = rule.action.layer;
      const next = Math.min(2, Math.max(0, mix[layer].volume + rule.action.delta));
      mix = { ...mix, [layer]: { ...mix[layer], volume: next } };
    } else if (rule.action.kind === "setEnvironment") {
      environmentId = rule.action.environmentId;
    } else if (rule.action.kind === "playSnippet") {
      if (!latched.has(rule.id)) {
        latched.add(rule.id);
        snippetIds.push(rule.action.snippetId);
      }
    }
  }

  return { mix, environmentId, snippetIds, latched };
}

function cloneMix(mix: LayerMix): LayerMix {
  const out = { ...DEFAULT_LAYER_MIX };
  for (const key of LAYER_KEYS) {
    out[key] = { ...mix[key] };
  }
  return out;
}

export function describeProfileRule(rule: ProfileRule): string {
  const metric =
    rule.metric === "speedKmh"
      ? "speed"
      : rule.metric === "throttle"
        ? "throttle"
        : rule.metric === "regen"
          ? "regen"
          : "Motion";
  const op = rule.op === "gt" ? ">" : rule.op === "lt" ? "<" : "is";
  const value =
    rule.metric === "context"
      ? String(rule.value)
      : rule.metric === "speedKmh"
        ? `${rule.value} km/h`
        : String(rule.value);
  let then = "";
  if (rule.action.kind === "mixDelta") {
    const pct = Math.round(rule.action.delta * 100);
    then = `layer ${layerName(rule.action.layer)} ${pct >= 0 ? "+" : ""}${pct}%`;
  } else if (rule.action.kind === "playSnippet") {
    then = `play snippet`;
  } else {
    then = `environment`;
  }
  return `IF ${metric} ${op} ${value} THEN ${then}`;
}

function layerName(layer: LayerKey) {
  if (layer === "body") return "core";
  if (layer === "beds") return "texture";
  return "accents";
}
