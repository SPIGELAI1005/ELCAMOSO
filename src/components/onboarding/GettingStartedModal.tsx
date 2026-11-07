import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

const STEPS = [
  {
    id: "setup",
    title: "Set up while parked",
    content:
      "Configure ELCAMOSO before you start moving. Choose your sound and drive mode while the vehicle is stationary. Open elcamoso.com/drive in your car's browser or on your phone.",
  },
  {
    id: "choose-sound",
    title: "Choose your sound",
    content:
      "Tap the experience name to open the sound picker. Browse Engine sounds (combustion character), Symphony (music shaped by motion), Worlds (atmospheric soundscapes), or Fusion (engine and music blended). Free access includes Racing V10, American Muscle V8, Dracula Carriage, and Latino Fiesta.",
  },
  {
    id: "drive-mode",
    title: "Live sound or Silent Capture",
    content:
      "Live sound plays audio in real time as you drive. Silent Capture records motion without playing audio—choose a genre before starting, then hear your drive as a song when you arrive. Silent Capture is an explicit opt-in; it does not run during normal Live drives.",
  },
  {
    id: "phone-pairing",
    title: "Phone pairing (optional)",
    content:
      "Phone pairing sends motion data from your phone to the car for richer acceleration detail. Scan the QR code on the Drive screen. Note: pairing does not enable background playback—the car browser must stay visible for audio to play.",
  },
  {
    id: "ready",
    title: "Check and go",
    content:
      "Before departing: adjust the car's media volume, confirm phone connection if pairing, and keep the browser visible. On Tesla and most car browsers, minimizing the browser stops audio. Once set, start the drive and let motion shape the sound.",
  },
] as const;

interface GettingStartedModalProps {
  open: boolean;
  onClose: () => void;
}

export function GettingStartedModal({ open, onClose }: GettingStartedModalProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setStep(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      handleClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  const currentStep = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-0 h-full w-full max-w-none bg-transparent p-0 backdrop:bg-black/80 sm:m-auto sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-lg"
      aria-labelledby="onboarding-title"
    >
      <div className="flex h-full flex-col bg-background sm:h-auto sm:rounded-lg">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <ElcamosoMark className="h-6 w-auto" />
            <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6 sm:py-8">
          <h2 id="onboarding-title" className="text-xl font-light tracking-tight sm:text-2xl">
            {currentStep?.title}
          </h2>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
            {currentStep?.content}
          </p>

          {isLast ? (
            <Link
              to="/instructions"
              onClick={handleClose}
              className="mt-6 text-xs tracking-[0.14em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Read full instructions
            </Link>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className="h-10 rounded-full px-5 text-xs tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
          >
            Back
          </button>

          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-foreground" : "bg-foreground/20"}`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              type="button"
              onClick={handleClose}
              className="h-10 rounded-full bg-primary px-5 text-xs tracking-[0.18em] text-primary-foreground uppercase"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="h-10 rounded-full bg-primary px-5 text-xs tracking-[0.18em] text-primary-foreground uppercase"
            >
              Next
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
