import { RumosoApp, type RumosoDemoView } from "./RumosoApp";
import { RumosoComingSoon } from "./RumosoComingSoon";
import type { RumosoAccessResult } from "@/lib/rumoso/server-fns";

export function rumosoViewForAccess(result: RumosoAccessResult): "app" | "coming-soon" {
  return result.ok ? "app" : "coming-soon";
}

export function RumosoGate({
  result,
  demo,
}: {
  result: RumosoAccessResult;
  demo?: RumosoDemoView;
}) {
  if (rumosoViewForAccess(result) === "coming-soon" || !result.ok) {
    return <RumosoComingSoon />;
  }
  return <RumosoApp accessEmail={result.email} dev={result.dev} {...(demo ? { demo } : {})} />;
}
