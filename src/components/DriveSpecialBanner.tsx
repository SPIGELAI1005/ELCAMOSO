import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DRIVE_SPECIAL_NAME,
  DRIVE_SPECIAL_PURPLE,
  driveSpecialBannerText,
  isDriveSpecialActive,
} from "@/lib/billing/drive-special";
import { useSettings } from "@/lib/drive/useSettings";
import { cn } from "@/lib/utils";

/** Purple promo strip for the Black Friday Special. Only shown inside the special window. */
export function DriveSpecialBanner({ className }: { className?: string }) {
  const { settings } = useSettings();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(isDriveSpecialActive());
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!show) return null;
  const copy = driveSpecialBannerText(settings.language);
  return (
    <div
      data-testid="drive-special-banner"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b px-4 py-2 text-xs",
        className,
      )}
      style={{
        borderColor: `${DRIVE_SPECIAL_PURPLE}55`,
        background: `linear-gradient(90deg, #08050b, ${DRIVE_SPECIAL_PURPLE}2e, #08050b), #08050b`,
      }}
    >
      <span
        className="font-semibold tracking-[0.18em] uppercase"
        style={{ color: DRIVE_SPECIAL_PURPLE }}
      >
        {DRIVE_SPECIAL_NAME}
      </span>
      <span className="text-foreground/90">{copy.text}</span>
      <Link
        to="/sounds"
        className="rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white uppercase"
        style={{ background: DRIVE_SPECIAL_PURPLE }}
      >
        {copy.cta}
      </Link>
    </div>
  );
}
