import { useState } from "react";

import { requestAccountSignInFn } from "@/lib/account/server-fns";
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
}

/** Minimal magic-link sign-in for saving Dynamic Drive Preview. */
export function AccountSignInDialog({
  open,
  onOpenChange,
  returnTo = "/drive?activateTrial=1",
}: AccountSignInDialogProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/60 bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-light tracking-tight">
            Save your Dynamic Drive Preview
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a free account to keep your preview time and return to Drive right after
            sign-in. Basic Drive stays free without an account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-foreground/30"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm tracking-[0.18em] text-primary-foreground uppercase disabled:opacity-50"
          >
            {busy ? "Sending…" : "Continue"}
          </button>
        </form>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {verifyUrl ? (
          <a
            href={verifyUrl}
            className="block text-sm text-foreground underline underline-offset-4"
          >
            Open secure sign-in link
          </a>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
