/** Clamp / sanitize untrusted strings for OG rendering. */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g; // eslint-disable-line no-control-regex

export function sanitizeOgText(
  raw: unknown,
  maxLen: number,
  opts?: { preserveNewlines?: boolean },
): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(CONTROL, "");
  if (opts?.preserveNewlines) {
    s = s
      .replace(/\r\n/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } else {
    s = s.replace(/\s+/g, " ").trim();
  }
  return s.slice(0, maxLen);
}

export function clampLines(text: string, maxCharsPerLine: number, maxLines: number): string {
  if (text.includes("\n")) {
    return text
      .split("\n")
      .slice(0, maxLines)
      .map((line) => line.trim().slice(0, maxCharsPerLine))
      .filter(Boolean)
      .join("\n");
  }
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const piece = w.length > maxCharsPerLine ? `${w.slice(0, maxCharsPerLine - 1)}…` : w;
    const next = current ? `${current} ${piece}` : piece;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = piece;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  let out = lines.slice(0, maxLines).join("\n");
  const flat = words.join(" ");
  if (flat.length > out.replace(/\n/g, " ").replace(/…/g, "").length && !out.includes("…")) {
    out =
      out
        .replace(/\n/g, " ")
        .slice(0, maxCharsPerLine * maxLines - 1)
        .trimEnd() + "…";
  }
  return out.slice(0, maxCharsPerLine * maxLines + maxLines);
}

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.0001 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
