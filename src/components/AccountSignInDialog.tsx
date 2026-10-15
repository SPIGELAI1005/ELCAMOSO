"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  getEmailOtpStatusFn,
  getGoogleSignInStatusFn,
  requestAccountSignInFn,
  requestEmailOtpFn,
  verifyEmailOtpFn,
} from "@/lib/account/server-fns";
import { useAccount } from "@/lib/account/AccountProvider";
import { sanitizeReturnTo } from "@/lib/account/return-to";
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

type Step = "email" | "code";

/**
 * Account sign-in: Google OAuth (when configured) + email six-digit code (Supabase OTP)
 * with magic-link fallback when OTP is not configured.
 * Code entry is designed for in-car use while the email is read on a phone.
 */
export function AccountSignInDialog({
  open,
  onOpenChange,
  returnTo = "/drive",
  title = "Sign in",
  description = "Sign in to sync your plan and preferences. Free Sound Profiles stay available without an account.",
}: AccountSignInDialogProps) {
  const reducedMotion = useReducedMotion();
  const { saveSession, refresh } = useAccount();
  const emailFieldId = useId();
  const codeFieldId = useId();
  const codeInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [otpAvailable, setOtpAvailable] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(60);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [google, otp] = await Promise.all([getGoogleSignInStatusFn(), getEmailOtpStatusFn()]);
        if (cancelled) return;
        setGoogleAvailable(google.available);
        setOtpAvailable(otp.available);
        setResendCooldownSeconds(otp.resendCooldownSeconds);
      } catch {
        if (!cancelled) {
          setGoogleAvailable(false);
          setOtpAvailable(false);
        }
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
      setStep("email");
      setCode("");
      setResendIn(0);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn, step]);

  useEffect(() => {
    if (step === "code" && open) {
      codeInputRef.current?.focus();
    }
  }, [open, step]);

  async function sendOtp(nextEmail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setVerifyUrl(null);
    try {
      const result = await requestEmailOtpFn({
        data: {
          email: nextEmail,
          returnTo,
          clientKey: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : null,
        },
      });
      setMessage(result.message);
      setResendCooldownSeconds(result.resendCooldownSeconds);
      setResendIn(result.resendCooldownSeconds);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink(nextEmail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setVerifyUrl(null);
    try {
      const origin = window.location.origin;
      const result = await requestAccountSignInFn({
        data: { email: nextEmail, returnTo, origin },
      });
      setMessage(result.message);
      setVerifyUrl(result.verifyUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (otpAvailable) {
      await sendOtp(email);
      return;
    }
    await sendMagicLink(email);
  }

  async function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifyEmailOtpFn({
        data: { email, code, returnTo },
      });
      saveSession({
        userId: result.userId,
        email: result.email,
        expiresAt: result.expiresAt,
      });
      await refresh();
      onOpenChange(false);
      // Restore preferences via AccountProvider — do not start Drive audio.
      const next = sanitizeReturnTo(result.returnTo);
      if (next !== window.location.pathname + window.location.search) {
        window.location.assign(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is invalid or has expired.");
      setCode("");
      codeInputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || busy) return;
    await sendOtp(email);
  }

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Confirm Google is configured, then use the server start route so the
      // pending PKCE cookie is set on the same redirect that goes to Google.
      const status = await getGoogleSignInStatusFn();
      if (!status.available) {
        setError("Google sign-in is not available.");
        setGoogleBusy(false);
        return;
      }
      const start = new URL("/auth/account/google/start", window.location.origin);
      start.searchParams.set("returnTo", sanitizeReturnTo(returnTo));
      window.location.assign(start.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
      setGoogleBusy(false);
    }
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
  }

  function onCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text") ?? "";
    onCodeChange(text);
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
                {step === "code" ? "Enter your code" : title}
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                {step === "code"
                  ? "Open the email on your phone and type the six-digit code here. No password needed."
                  : description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {step === "email" ? (
            <>
              {googleAvailable ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    disabled={googleBusy || busy}
                    onClick={() => void handleGoogleSignIn()}
                    className="inline-flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-foreground/30 disabled:opacity-50"
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

              <form onSubmit={(event) => void handleEmailSubmit(event)} className="space-y-4">
                <label htmlFor={emailFieldId} className="block space-y-2">
                  <span className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                    Email
                  </span>
                  <input
                    id={emailFieldId}
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 min-h-12 w-full rounded-full border border-border bg-transparent px-5 text-sm outline-none transition-colors focus:border-foreground/30"
                    placeholder="you@example.com"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || googleBusy}
                  className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
                >
                  {busy
                    ? "Sending…"
                    : otpAvailable
                      ? "Send sign-in code"
                      : "Continue with email"}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={(event) => void handleCodeSubmit(event)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Code sent to <span className="text-foreground">{email}</span>
              </p>
              <button
                type="button"
                className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setMessage(null);
                }}
              >
                Edit email
              </button>

              <label htmlFor={codeFieldId} className="block space-y-2">
                <span className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  Six-digit code
                </span>
                <input
                  ref={codeInputRef}
                  id={codeFieldId}
                  type="text"
                  name="one-time-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => onCodeChange(event.target.value)}
                  onPaste={onCodePaste}
                  aria-describedby={`${codeFieldId}-hint`}
                  className="h-14 min-h-12 w-full rounded-full border border-border bg-transparent px-5 text-center font-mono text-2xl tracking-[0.4em] tabular-nums outline-none transition-colors focus:border-foreground/30"
                  placeholder="••••••"
                />
                <span id={`${codeFieldId}-hint`} className="block text-[11px] text-muted-foreground">
                  Paste is supported. The countdown is for resend only - it does not change when the
                  code expires on the server.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify and continue"}
              </button>

              <button
                type="button"
                disabled={busy || resendIn > 0}
                onClick={() => void handleResend()}
                className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-full border border-border text-[11px] tracking-[0.18em] uppercase disabled:opacity-50"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </form>
          )}

          {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
          {verifyUrl ? (
            <a
              href={verifyUrl}
              className="block text-center text-sm text-foreground underline underline-offset-4"
            >
              Open secure sign-in link
            </a>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Basic Drive stays free. Motion data stays on this device unless you opt into ELCAMOSO
            Cloud. Premium access follows your plan and offline lease policy.
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
