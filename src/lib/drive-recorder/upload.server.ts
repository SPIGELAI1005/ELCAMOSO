import { DRIVE_LOG_MAX_UPLOAD_BYTES, driveLogBlobPath } from "./recorder-core";

export function driveLogUploadConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env["BLOB_READ_WRITE_TOKEN"]?.trim());
}

export type DriveLogUploadResult =
  | { ok: true; pathname: string; url: string; bytes: number }
  | { ok: false; status: number; error: string };

export async function handleDriveLogUpload(
  request: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    put?: (
      pathname: string,
      body: ArrayBuffer,
      opts: Record<string, unknown>,
    ) => Promise<{ url: string; pathname: string }>;
    now?: Date;
  } = {},
): Promise<DriveLogUploadResult> {
  const env = deps.env ?? process.env;
  if (!driveLogUploadConfigured(env)) {
    return {
      ok: false,
      status: 503,
      error: "Upload is not set up on the server yet (no Blob token). Use Download instead.",
    };
  }
  const id = new URL(request.url).searchParams.get("id") ?? "drive";
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return { ok: false, status: 400, error: "Empty upload." };
  if (body.byteLength > DRIVE_LOG_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Recording is too large to upload. Use Download instead.",
    };
  }
  const bytes = new Uint8Array(body);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    return { ok: false, status: 415, error: "Expected a gzip-compressed drive log." };
  }
  const put =
    deps.put ??
    (async (pathname: string, data: ArrayBuffer, opts: Record<string, unknown>) => {
      const blob = await import("@vercel/blob");
      return blob.put(
        pathname,
        Buffer.from(data),
        opts as unknown as Parameters<typeof blob.put>[2],
      );
    });
  try {
    const res = await put(driveLogBlobPath(id, deps.now), body, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/gzip",
      token: env["BLOB_READ_WRITE_TOKEN"],
    });
    return { ok: true, pathname: res.pathname, url: res.url, bytes: body.byteLength };
  } catch (error) {
    console.error("[drive-logs] upload failed", error instanceof Error ? error.message : error);
    return { ok: false, status: 502, error: "Upload to storage failed. Use Download instead." };
  }
}
