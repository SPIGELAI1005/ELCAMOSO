import { createServerFn } from "@tanstack/react-start";

import type { TelemetryBatch } from "@/lib/telemetry/store";

/** Client-safe entry for TelemetryBridge — no cloud/garage handler imports. */
export const ingestTelemetryFn = createServerFn({ method: "POST" })
  .inputValidator((data: TelemetryBatch) => data)
  .handler(async ({ data }) => {
    const { ingestTelemetry } = await import("@/lib/telemetry/store");
    return ingestTelemetry(data);
  });
