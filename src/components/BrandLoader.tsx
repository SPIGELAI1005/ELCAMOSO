import { useEffect, useState } from "react";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

export function BrandLoader({ label }: { label?: string }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s % 3) + 1), 420);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <ElcamosoMark intensity={step / 3} className="h-8 w-auto" />
      {label ? (
        <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">{label}</p>
      ) : null}
    </div>
  );
}
