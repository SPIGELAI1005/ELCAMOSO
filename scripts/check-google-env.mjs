import { loadEnv } from "vite";
import { createRequire } from "node:module";

const env = loadEnv("development", process.cwd(), "");
const keys = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "ELCAMOSO_ENV",
];
for (const k of keys) {
  const v = env[k] ?? "";
  if (k.includes("SECRET")) console.log(k, `len=${v.length}`);
  else console.log(k, v ? `${v.slice(0, 28)}… (len=${v.length})` : "(empty)");
}

for (const k of keys) process.env[k] = env[k] ?? "";

const require = createRequire(import.meta.url);
 // dynamic import of TS via vite-node isn't available; duplicate presence logic:
function read(name) {
  return (process.env[name] ?? "").trim();
}
const presence = {
  clientId: Boolean(read("GOOGLE_CLIENT_ID")),
  clientSecret: Boolean(read("GOOGLE_CLIENT_SECRET")),
  redirectUri: Boolean(read("GOOGLE_REDIRECT_URI")),
};
console.log("presence", presence);
console.log(
  "configured",
  presence.clientId && presence.clientSecret && presence.redirectUri,
);
