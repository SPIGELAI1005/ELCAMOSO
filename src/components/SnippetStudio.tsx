import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_SNIPPET_BYTES,
  SNIPPET_TRIGGERS,
  type SnippetTrigger,
  type SoundSnippet,
} from "@/lib/sound/snippets";

/**
 * Record or upload short audio snippets and map them to driving states, so a
 * sound personality can carry your own voice, horn or jingle.
 */
export function SnippetStudio({
  snippets,
  onChange,
  className = "",
}: {
  snippets: SoundSnippet[];
  onChange: (next: SoundSnippet[]) => void;
  className?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const add = useCallback(
    (name: string, dataUrl: string) => {
      const snippet: SoundSnippet = {
        id: `snip-${Date.now().toString(36)}`,
        name,
        dataUrl,
        trigger: "throttle",
        level: 0.8,
        rate: 1,
        createdAt: Date.now(),
        everySeconds: 20,
      };
      onChange([...snippets, snippet]);
    },
    [onChange, snippets],
  );

  const readFile = async (file: File, name: string) => {
    if (file.size > MAX_SNIPPET_BYTES) {
      setError("That clip is too long for on-device storage. Keep it under a few seconds.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsDataURL(file);
    });
    setError(null);
    add(name, dataUrl);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void readFile(
          new File([blob], "recording", { type: blob.type }),
          `Recording ${snippets.length + 1}`,
        );
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone unavailable. You can still upload a clip.");
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const patch = (id: string, next: Partial<SoundSnippet>) =>
    onChange(snippets.map((s) => (s.id === id ? { ...s, ...next } : s)));

  const remove = (id: string) => onChange(snippets.filter((s) => s.id !== id));

  const play = (snippet: SoundSnippet) => {
    previewRef.current?.pause();
    const audio = new Audio(snippet.dataUrl);
    audio.volume = Math.min(1, snippet.level);
    audio.playbackRate = snippet.rate;
    previewRef.current = audio;
    void audio.play().catch(() => setError("This clip could not be played back."));
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Your own snippets
        </h3>
        <span className="text-xs text-muted-foreground">{snippets.length} saved</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Short clips, mapped to what the car is doing. They stay on this device.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={() => (recording ? stopRecording() : void startRecording())}
          aria-pressed={recording}
          className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
        >
          {recording ? "Stop recording" : "Record"}
        </button>
        <label className="h-11 cursor-pointer rounded-full border border-border px-6 text-[11px] leading-[2.75rem] tracking-[0.24em] uppercase hover:bg-secondary">
          Upload clip
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file, file.name.replace(/\.[^.]+$/, ""));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="mt-4 text-xs text-muted-foreground">{error}</p> : null}

      <ul className="mt-8 space-y-8">
        {snippets.map((snippet) => (
          <li key={snippet.id} className="border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <input
                value={snippet.name}
                maxLength={40}
                aria-label="Snippet name"
                onChange={(e) => patch(snippet.id, { name: e.target.value })}
                className="h-9 flex-1 border-b border-border bg-transparent text-sm outline-none focus:border-foreground"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => play(snippet)}
                  className="h-9 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase hover:bg-secondary"
                >
                  Play
                </button>
                <button
                  onClick={() => remove(snippet.id)}
                  className="h-9 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {SNIPPET_TRIGGERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patch(snippet.id, { trigger: t.id as SnippetTrigger })}
                  aria-pressed={snippet.trigger === t.id}
                  title={t.hint}
                  className={`h-9 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                    snippet.trigger === t.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Range
                id={`${snippet.id}-level`}
                label="Level"
                value={snippet.level}
                min={0}
                max={1.5}
                onChange={(v) => patch(snippet.id, { level: v })}
              />
              <Range
                id={`${snippet.id}-rate`}
                label="Speed"
                value={snippet.rate}
                min={0.5}
                max={2}
                onChange={(v) => patch(snippet.id, { rate: v })}
              />
              {snippet.trigger === "cruise" ? (
                <Range
                  id={`${snippet.id}-every`}
                  label="Repeat every (s)"
                  value={snippet.everySeconds ?? 20}
                  min={5}
                  max={120}
                  step={1}
                  onChange={(v) => patch(snippet.id, { everySeconds: v })}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step = 0.05,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {step < 1 ? value.toFixed(2) : Math.round(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-px w-full appearance-none bg-border accent-foreground"
      />
    </div>
  );
}
