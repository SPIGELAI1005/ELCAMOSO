import { useEffect, useState } from "react";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";

export function BrandLoader({ label }: { label?: string }) {
  const [step, setStep] = useState(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setStep((s) => (s % 3) + 1), 420);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className="flex flex-col items-center gap-4">
      <ElcamosoMark
        intensity={reducedMotion ? 1 : step / 3}
        reducedMotion={reducedMotion}
        className="h-8 w-auto"
      />

      {label ? (
        <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">{label}</p>
      ) : null}
    </div>
  );
}
