import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { normalizePairCode } from "@/lib/phone-sync/protocol";

export const Route = createFileRoute("/sync/")({
  component: SyncCodeEntry,
  head: () => ({
    meta: [{ title: "Pair phone · ELCAMOSO" }, { name: "robots", content: "noindex" }],
  }),
});

function SyncCodeEntry() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const code = normalizePairCode(value);
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-light">Pair your phone</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter the code shown on the car screen.</p>
      <input
        className="mt-6 w-full rounded-xl border border-border bg-transparent px-4 py-3 font-mono text-xl tracking-widest uppercase"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="XXXXX-XXXXX"
        autoCapitalize="characters"
        autoComplete="off"
        inputMode="text"
      />
      <button
        type="button"
        disabled={!code}
        className="mt-4 w-full rounded-full border border-border px-4 py-3 disabled:opacity-40"
        onClick={() => code && void navigate({ to: "/sync/$code", params: { code } })}
      >
        Continue
      </button>
    </main>
  );
}
