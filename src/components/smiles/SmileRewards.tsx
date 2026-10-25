"use client";

import { useEffect, useRef, useState } from "react";

import { SmileSymbol } from "@/components/smiles/SmilesSymbols";
import { useAccount } from "@/lib/account/AccountProvider";
import { emptySmileStatus, REF_CODE_RE, type SmileStatus } from "@/lib/smiles/rewards";
import { applySmileReferralFn, getSmileStatusFn } from "@/lib/smiles/rewards-server-fns";
import { type CardTheme, loadLocalTheme, resolveTheme } from "@/lib/smiles/themes";
import { cn } from "@/lib/utils";

const EVT = "elcamoso:smiles";
const REF_KEY = "elcamoso.smileRef.v1";

/** Tell every mounted status hook to refetch (after an award or a redemption). */
export function notifySmilesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function useSmileStatus(enabled = true): SmileStatus {
  const [s, setS] = useState<SmileStatus>(emptySmileStatus);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      getSmileStatusFn()
        .then((r) => live && setS(r))
        .catch(() => undefined);
    void load();
    window.addEventListener(EVT, load);
    return () => {
      live = false;
      window.removeEventListener(EVT, load);
    };
  }, [enabled]);
  return s;
}

export function SmileLevelRing({ status, className }: { status: SmileStatus; className?: string }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const p = status.level.progress;
  return (
    <div data-testid="smile-level-ring" className={cn("flex items-center gap-4", className)}>
      <div className="relative h-[76px] w-[76px] shrink-0">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle cx="38" cy="38" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="5" />
          <circle
            cx="38"
            cy="38"
            r={R}
            fill="none"
            stroke="#e53935"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${C * p} ${C}`}
          />
        </svg>
        <SmileSymbol className="absolute inset-0 m-auto h-8 w-auto text-white" />
      </div>
      <div className="min-w-0 text-left">
        <div className="text-2xl font-light tabular-nums">{status.balance.toLocaleString("en")} smiles</div>
        <div className="text-[11px] tracking-[0.22em] text-[#e53935] uppercase">{status.level.name}</div>
        <div className="text-xs text-muted-foreground">
          {status.level.nextAt != null
            ? `${(status.level.nextAt - status.earned).toLocaleString("en")} to ${status.level.next}`
            : "Top level. Pure grin."}
        </div>
      </div>
    </div>
  );
}

/** Floating "+N smiles" toast. */
export function SmileToast({
  amount,
  label,
  text,
  onDone,
}: {
  amount: number;
  label?: string | undefined;
  text?: string | undefined;
  onDone: () => void;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), text ? 5200 : 3200);
    return () => clearTimeout(t);
  }, [amount, text]);
  return (
    <div
      role="status"
      data-testid="smile-toast"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/85 px-5 py-2.5 text-white shadow-[0_0_30px_rgba(229,57,53,0.35)] backdrop-blur">
        <SmileSymbol className="h-6 w-auto text-white" />
        <span className="text-lg font-light tabular-nums">{text ?? `+${amount} smiles`}</span>
        {label ? <span className="text-xs text-white/60">{label}</span> : null}
      </div>
    </div>
  );
}

/** Captures ?ref=code from any page; credits the referrer once the visitor is signed in. */
const INVITE_SEEN_KEY = "elcamoso.inviteRewardSeen.v1";

export function SmileReferralBridge() {
  const { isAuthenticated } = useAccount();
  const status = useSmileStatus(isAuthenticated);
  const [invite, setInvite] = useState<string | null>(null);
  const rewardId = status.inviteReward?.id ?? null;
  const role = status.inviteReward?.role ?? null;
  useEffect(() => {
    if (!rewardId) return;
    try {
      if (localStorage.getItem(INVITE_SEEN_KEY) === rewardId) return;
      localStorage.setItem(INVITE_SEEN_KEY, rewardId);
    } catch {
      return;
    }
    setInvite(
      role === "friend"
        ? "Drive+ unlocked: 1 month on your crew"
        : role === "inviter"
          ? "Your friend drove! +1 month Drive+ for you"
          : "Your friend drove! They got 1 month Drive+",
    );
  }, [rewardId, role]);
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase();
      if (ref && REF_CODE_RE.test(ref)) localStorage.setItem(REF_KEY, ref);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(REF_KEY);
    } catch {
      return;
    }
    if (!code) return;
    void applySmileReferralFn({ data: { code } })
      .catch(() => undefined)
      .finally(() => {
        try {
          localStorage.removeItem(REF_KEY);
        } catch {
          /* ignore */
        }
      });
  }, [isAuthenticated]);
  return invite ? <SmileToast amount={0} text={invite} onDone={() => setInvite(null)} /> : null;
}

/** Active Smiles card theme: server value, else localStorage; always an owned theme or default. */
export function useActiveTheme(): { theme: CardTheme; status: SmileStatus } {
  const status = useSmileStatus();
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    const load = () => setLocal(loadLocalTheme());
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  return { theme: resolveTheme(status.activeTheme ?? local, status.owned), status };
}
