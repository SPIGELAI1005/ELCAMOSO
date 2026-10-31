import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HALLOWEEN_ARTICLE_PATH, HALLOWEEN_ORANGE, HALLOWEEN_TAG, isHalloweenWindow } from "@/lib/halloween/halloween";
import { cn } from "@/lib/utils";

/** Second promo strip (sits under the Founders banner). Only shown inside the Halloween window. */
export function HalloweenBanner({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(isHalloweenWindow());
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!show) return null;
  return (
    <div
      data-testid="halloween-banner"
      className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b px-4 py-2 text-xs", className)}
      style={{ borderColor: `${HALLOWEEN_ORANGE}55`, background: `linear-gradient(90deg, #0b0705, ${HALLOWEEN_ORANGE}26, #0b0705)` }}
    >
      <span className="font-semibold tracking-[0.18em] uppercase" style={{ color: HALLOWEEN_ORANGE }}>
        {HALLOWEEN_TAG}
      </span>
      <span className="text-foreground/90">Dracula Carriage and Police Patrol are here, both free until 1 Nov.</span>
      <Link
        to={HALLOWEEN_ARTICLE_PATH}
        className="rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-black uppercase"
        style={{ background: HALLOWEEN_ORANGE }}
      >
        See the sounds
      </Link>
    </div>
  );
}
