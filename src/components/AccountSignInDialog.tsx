"use client";

import { useEffect, useState } from "react";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  beginGoogleSignInFn,
  getGoogleSignInStatusFn,
  requestAccountSignInFn,
} from "@/lib/account/server-fns";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AccountSignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnTo?: string;
  title?: string;
  description?: string;
}

/** Account sign-in: Google OAuth (when configured) + email magic link. */
export function AccountSignInDialog({
  open,
  onOpenChange,
  returnTo = "/drive?activateTrial=1",
  title = "Sign in",
  description = "Sign in to sync your plan, save Dynamic Drive Preview, and pick up where you left off.",
}: AccountSignInDialogProps) {
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await getGoogleSignInStatusFn();
        if (!cancelled) setGoogleAvailable(status.available);
      } catch {
        if (!cancelled) setGoogleAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setMessage(null);
      setVerifyUrl(null);
      setGoogleBusy(false);
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setVerifyUrl(null);
    try {
      const origin = window.location.origin;
      const result = await requestAccountSignInFn({
        data: { email, returnTo, origin },
      });
      setMessage(result.message);
      setVerifyUrl(result.verifyUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await beginGoogleSignInFn({ data: { returnTo } });
      if (!result.available || !result.authorizeUrl) {
        setError(result.message ?? "Google sign-in is not available.");
        setGoogleBusy(false);
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
      setGoogleBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-border/60 bg-background p-0 sm:rounded-2xl">
        <div className="relative border-b border-border/60 px-6 pt-10 pb-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,245,247,0.06),transparent_55%)]" />
          <div className="relative flex flex-col items-center text-center">
            <ElcamosoMark
              intensity={1}
              animate={!reducedMotion}
              reducedMotion={reducedMotion}
              className="h-16 w-auto text-foreground sm:h-[4.5rem]"
            />
            <p className="mt-5 text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
              E L C A M O S O
            </p>
            <DialogHeader className="mt-5 space-y-2">
              <DialogTitle className="text-center text-2xl font-light tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {googleAvailable ? (
            <div className="space-y-4">
              <button
                type="button"
                disabled={googleBusy || busy}
                onClick={() => void handleGoogleSignIn()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-foreground/30 disabled:opacity-50"
              >
                <GoogleMark />
                {googleBusy ? "Redirecting…" : "Continue with Google"}
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  or email
                </p>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          ) : null}

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-full border border-border bg-transparent px-5 py-3.5 text-sm outline-none transition-colors focus:border-foreground/30"
                placeholder="you@example.com"
              />
            </label>
            <button
              type="submit"
              disabled={busy || googleBusy}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
            >
              {busy ? "Sending…" : "Continue with email"}
            </button>
          </form>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {verifyUrl ? (
            <a
              href={verifyUrl}
              className="block text-center text-sm text-foreground underline underline-offset-4"
            >
              Open secure sign-in link
            </a>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Basic Drive stays free. Motion data stays on this device unless you opt into ELCAMOSO
            Cloud.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        opacity="0.9"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        opacity="0.75"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        opacity="0.6"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        opacity="0.8"
      />
    </svg>
  );
}
