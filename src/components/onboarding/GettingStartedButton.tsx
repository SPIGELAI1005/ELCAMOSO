import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { GettingStartedModal } from "./GettingStartedModal";

interface GettingStartedButtonProps {
  hidden?: boolean;
}

export function GettingStartedButton({ hidden }: GettingStartedButtonProps) {
  const [open, setOpen] = useState(false);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 text-xs tracking-[0.14em] text-muted-foreground uppercase shadow-lg backdrop-blur-sm transition-colors hover:border-foreground/40 hover:text-foreground md:bottom-6"
        aria-label="Getting started guide"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Getting started</span>
      </button>
      <GettingStartedModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
