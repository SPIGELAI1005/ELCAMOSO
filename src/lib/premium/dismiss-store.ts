import type { PremiumContext } from "@/lib/premium/contexts";

const STORAGE_KEY = "elcamoso.premium.dismiss.v1";

type DismissStore = Partial<Record<PremiumContext, true>>;

const memoryFallback = new Map<string, string>();

function readRaw(): string | null {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(STORAGE_KEY);
  }
  return memoryFallback.get(STORAGE_KEY) ?? null;
}

function writeRaw(value: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  memoryFallback.set(STORAGE_KEY, value);
}

function readStore(): DismissStore {
  try {
    const raw = readRaw();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as DismissStore;
  } catch {
    return {};
  }
}

function writeStore(store: DismissStore): void {
  writeRaw(JSON.stringify(store));
}

export function isPremiumPromptDismissed(context: PremiumContext): boolean {
  return readStore()[context] === true;
}

export function dismissPremiumPrompt(context: PremiumContext): void {
  writeStore({ ...readStore(), [context]: true });
}

export function resetPremiumPromptDismissalsForTests(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  memoryFallback.delete(STORAGE_KEY);
}
