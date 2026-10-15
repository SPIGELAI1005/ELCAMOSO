import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const clientId = (env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = (env.GOOGLE_CLIENT_SECRET || "").trim();
const redirectUri = (env.GOOGLE_REDIRECT_URI || "").trim();

console.log(
  JSON.stringify(
    {
      clientIdPrefix: clientId.slice(0, 24),
      secretLen: clientSecret.length,
      secretPrefixOk: clientSecret.startsWith("GOCSPX-"),
      redirectUri,
    },
    null,
    2,
  ),
);

// Dummy code: if credentials are valid Google returns invalid_grant;
// if secret/id are wrong Google returns invalid_client.
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code: "elcamoso-credential-probe",
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
  code_verifier: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body,
});
const json = await res.json().catch(() => ({}));
console.log(
  JSON.stringify(
    {
      httpStatus: res.status,
      error: json.error ?? null,
      // Do not print full description if it contains secrets; Google's messages are safe.
      error_description: json.error_description ?? null,
      credentialsAcceptedByGoogle: json.error === "invalid_grant",
    },
    null,
    2,
  ),
);
