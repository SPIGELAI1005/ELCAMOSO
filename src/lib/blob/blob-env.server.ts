/**
 * Resolve Vercel Blob credentials. Supports:
 *  - BLOB_READ_WRITE_TOKEN (classic)
 *  - prefixed tokens injected when a store is connected with a custom prefix, e.g. ELCAMOSO_READ_WRITE_TOKEN
 *  - OIDC (BLOB_STORE_ID + Vercel OIDC token) – the SDK authenticates itself when no token is passed.
 * Never log values.
 */
export type BlobAuthSource = "token" | "prefixed-token" | "oidc" | "none";

export function resolveBlobAuth(env: NodeJS.ProcessEnv = process.env): {
  source: BlobAuthSource;
  /** Extra options to pass to @vercel/blob calls. */
  opts: { token?: string };
} {
  const direct = env["BLOB_READ_WRITE_TOKEN"]?.trim();
  if (direct) return { source: "token", opts: { token: direct } };
  const key = Object.keys(env)
    .filter(
      (k) => /_READ_WRITE_TOKEN$/.test(k) && (env[k] ?? "").trim().startsWith("vercel_blob_rw_"),
    )
    .sort()[0];
  if (key) return { source: "prefixed-token", opts: { token: env[key]!.trim() } };
  if (
    env["BLOB_STORE_ID"]?.trim() ||
    Object.keys(env).some((k) => /BLOB_STORE_ID$/.test(k) && env[k])
  )
    return { source: "oidc", opts: {} };
  return { source: "none", opts: {} };
}

export function blobConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveBlobAuth(env).source !== "none";
}

/** Store access mode. Default private (George's store); override with BLOB_ACCESS=public. */
export function blobAccess(env: NodeJS.ProcessEnv = process.env): "private" | "public" {
  return env["BLOB_ACCESS"]?.trim() === "public" ? "public" : "private";
}
