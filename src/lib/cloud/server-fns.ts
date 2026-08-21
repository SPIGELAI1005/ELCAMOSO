import { createServerFn } from "@tanstack/react-start";
import { coachCopy, readCloud, upsertCloud, type CloudDocument } from "@/lib/cloud/store";
import { ingestTelemetry, loadShare, saveShare, type TelemetryBatch } from "@/lib/telemetry/store";
import { recipeFromPrompt, type SoundRecipe } from "@/lib/sound/recipes";
import type { TraceAggregates } from "@/lib/drive/traces";
import type { CustomSound } from "@/lib/drive/settings";

export const syncGarageFn = createServerFn({ method: "POST" })
  .inputValidator((data: CloudDocument) => data)
  .handler(({ data }) => upsertCloud(data));

export const loadGarageFn = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(({ data }) => readCloud(data.accountId));

export const promptToSoundFn = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }): Promise<SoundRecipe> => {
    const key = process.env["OPENAI_API_KEY"];
    if (!key) return recipeFromPrompt(data.prompt);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "Return a compact JSON recipe with name, description, baseId, tweaks (pitch brightness grit texture rhythm character 0-2, signals boolean), environmentId, mix. No location data.",
            },
            { role: "user", content: data.prompt },
          ],
        }),
      });
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "")) as SoundRecipe;
      return parsed.name ? parsed : recipeFromPrompt(data.prompt);
    } catch {
      return recipeFromPrompt(data.prompt);
    }
  });

export const driveCoachFn = createServerFn({ method: "POST" })
  .inputValidator((data: { aggregates: TraceAggregates }) => data)
  .handler(async ({ data }) => {
    const local = coachCopy(data.aggregates);
    const key = process.env["OPENAI_API_KEY"];
    if (!key) return local;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a concise EV sound coach. Use only the supplied aggregates. Never ask for GPS. Reply with two short sentences: summary then a Sound Profile suggestion.",
            },
            { role: "user", content: JSON.stringify(data.aggregates) },
          ],
        }),
      });
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) return local;
      const [summary, suggestion] = text.split(/(?<=\.)\s+/);
      return { summary: summary ?? local.summary, suggestion: suggestion ?? local.suggestion };
    } catch {
      return local;
    }
  });

export const ingestTelemetryFn = createServerFn({ method: "POST" })
  .inputValidator((data: TelemetryBatch) => data)
  .handler(({ data }) => ingestTelemetry(data));

export const createShareFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sound: CustomSound }) => data)
  .handler(({ data }) => ({ code: saveShare(data.sound) }));

export const loadShareFn = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => data)
  .handler(({ data }) => loadShare(data.code));
