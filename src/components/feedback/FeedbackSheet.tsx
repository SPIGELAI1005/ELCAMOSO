import { useEffect, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_MIN_CHARS,
  detectDevice,
  type FeedbackCategory,
} from "@/lib/feedback/feedback-core";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "elcamoso.feedback.history.v1";
const CLIENT_KEY = "elcamoso.feedback.client.v1";

interface SentItem {
  id: string;
  at: string;
  category: FeedbackCategory;
  message: string;
  context?: string | undefined;
}

function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function loadHistory(): SentItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v) ? (v as SentItem[]).slice(-30) : [];
  } catch {
    return [];
  }
}

export interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soundProfileId?: string | undefined;
  soundProfileName?: string | undefined;
  screen?: string | undefined;
}

export function FeedbackSheet({
  open,
  onOpenChange,
  soundProfileId,
  soundProfileName,
  screen = "drive",
}: FeedbackSheetProps) {
  const [category, setCategory] = useState<FeedbackCategory>("issue");
  const [message, setMessage] = useState("");
  const [attachContext, setAttachContext] = useState(true);
  const [history, setHistory] = useState<SentItem[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const openedAt = useRef(0);
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    setHistory(loadHistory());
    setStatus("idle");
    setError(null);
  }, [open]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [history, open]);

  const device =
    typeof window === "undefined"
      ? "unknown"
      : detectDevice(navigator.userAgent, window.innerWidth);
  const contextLabel = [soundProfileName, device].filter(Boolean).join(" · ");
  const trimmed = message.trim();
  const canSend =
    status !== "sending" &&
    trimmed.length >= FEEDBACK_MIN_CHARS &&
    trimmed.length <= FEEDBACK_MAX_CHARS;

  async function send() {
    if (!canSend) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          clientId: clientId(),
          website,
          elapsedMs: Date.now() - openedAt.current,
          context: attachContext
            ? {
                soundProfileId,
                soundProfileName,
                device,
                screen,
                path: window.location.pathname,
              }
            : { device },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        at?: string;
        error?: string;
      };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Could not send. Please try again.");
      const item: SentItem = {
        id: body.id,
        at: body.at ?? new Date().toISOString(),
        category,
        message: trimmed,
        context: attachContext ? contextLabel : undefined,
      };
      const next = [...loadHistory(), item].slice(-30);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage full / private mode */
      }
      setHistory(next);
      setMessage("");
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not send.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="feedback-sheet"
        className="mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col gap-3 rounded-t-3xl border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-light tracking-[0.18em] uppercase">Feedback</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Report an issue or suggest an improvement.
          </SheetDescription>
          <p
            data-testid="feedback-drive-warning"
            className="text-xs font-semibold tracking-[0.14em] text-[#e53935]"
          >
            Please don&apos;t type and drive!
          </p>
        </SheetHeader>

        <div className="min-h-[6rem] flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border/60 bg-foreground/[0.03] p-3">
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Your messages will appear here. We read every one.
            </p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm font-light whitespace-pre-wrap text-background">
                  {h.message}
                </div>
                <span className="mt-1 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  {FEEDBACK_CATEGORY_LABEL[h.category]} ·{" "}
                  {new Date(h.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  {h.context ? ` · ${h.context}` : ""} · Sent ✓
                </span>
              </div>
            ))
          )}
          {status === "sent" ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border px-3.5 py-2 text-sm font-light">
                Thanks! Your message reached the ELCAMOSO team.
              </div>
            </div>
          ) : null}
          <div ref={listEnd} />
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="Category">
          {FEEDBACK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-10 flex-1 rounded-full border text-[11px] tracking-[0.2em] uppercase transition-colors",
                category === c
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/60 hover:text-foreground",
              )}
            >
              {FEEDBACK_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={3}
            maxLength={FEEDBACK_MAX_CHARS}
            placeholder={
              category === "issue"
                ? "What went wrong? e.g. the sound cut out after a gear change…"
                : category === "suggestion"
                  ? "What would make ELCAMOSO better?"
                  : "Your message…"
            }
            aria-label="Message"
            className="w-full resize-none rounded-2xl border border-border bg-transparent px-4 py-3 pr-16 text-sm font-light outline-none placeholder:text-muted-foreground/70 focus:border-foreground/60"
          />
          <span className="pointer-events-none absolute right-4 bottom-3 text-[10px] text-muted-foreground">
            {trimmed.length}/{FEEDBACK_MAX_CHARS}
          </span>
          {/* Honeypot (hidden from people). */}
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            name="website"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={attachContext}
              onChange={(e) => setAttachContext(e.target.checked)}
              className="size-4 accent-current"
            />
            <span className="truncate">Attach: {contextLabel || "device info"}</span>
          </label>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-12 shrink-0 rounded-full bg-foreground px-7 text-[11px] tracking-[0.2em] text-background uppercase transition-opacity disabled:opacity-35"
          >
            {status === "sending" ? "Sending…" : "Send"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-[#e53935]">
            {error}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
