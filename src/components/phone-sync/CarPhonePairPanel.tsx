import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { SCANNABLE_QR_OPTIONS, qrOrigin } from "@/lib/qr";
import {
  getCarPairState,
  startCarPairing,
  stopCarPairing,
  subscribeCarPair,
  type CarPairStatus,
} from "@/lib/phone-sync/car-session";
import { formatPairCode } from "@/lib/phone-sync/protocol";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CarPairStatus, string> = {
  idle: "Not paired",
  connecting: "Opening…",
  waiting: "Waiting for phone",
  paired: "Phone paired",
  disconnected: "Phone disconnected — using car data",
  unavailable: "Pairing unavailable right now",
};

export function useCarPairState() {
  const [s, setS] = useState(getCarPairState);
  useEffect(() => subscribeCarPair(setS), []);
  return s;
}

/** Small dot + label, for pages that just need to show the link state. */
export function PhonePairIndicator({ className }: { className?: string }) {
  const { status } = useCarPairState();
  if (status === "idle") return null;
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "paired"
            ? "bg-emerald-400"
            : status === "disconnected"
              ? "bg-amber-400"
              : "bg-muted-foreground",
        )}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CarPhonePairPanel({ className }: { className?: string }) {
  const { status, code } = useCarPairState();
  const [qr, setQr] = useState<string | null>(null);
  const url = code ? `${qrOrigin()}/sync/${code}` : null;

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let live = true;
    void QRCode.toDataURL(url, SCANNABLE_QR_OPTIONS).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <section className={cn("rounded-2xl border border-border p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Pair phone
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your phone can add altitude and motion sensing so the music follows climbs, launches and
            braking more closely.
          </p>
        </div>
        {status === "idle" || status === "unavailable" ? (
          <button
            type="button"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm"
            onClick={() => void startCarPairing()}
          >
            Pair phone
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm"
            onClick={stopCarPairing}
          >
            Unpair
          </button>
        )}
      </div>
      <div className="mt-3">
        <PhonePairIndicator />
        {status === "unavailable" && (
          <p className="text-xs text-muted-foreground">{STATUS_LABEL.unavailable}</p>
        )}
      </div>
      {code && status !== "paired" && (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          {qr && (
            <img
              src={qr}
              alt="Scan with your phone to pair"
              className="h-40 w-40 rounded-lg bg-white p-1"
            />
          )}
          <div>
            <p className="text-sm">Scan with your phone camera, or open</p>
            <p className="mt-1 font-mono text-sm">{qrOrigin().replace(/^https?:\/\//, "")}/sync</p>
            <p className="mt-2 text-sm">and enter code</p>
            <p className="mt-1 font-mono text-2xl tracking-widest">{formatPairCode(code)}</p>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Location is relayed live from phone to car only. It is never stored.
      </p>
    </section>
  );
}
