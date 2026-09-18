/**
 * Dedicated drive-relay host — long-lived WebSocket + session store.
 *
 * Vendor-isolated: no Google / Stripe / database secrets.
 * Run: `npm run relay:dev` (local) or deploy per docs/DRIVE_RELAY_DEPLOYMENT.md
 *
 * Shares protocol / hub / store with the main app via relative imports.
 */
import { createServer } from "node:http";
import { attachRelayWsUpgrade, RELAY_WS_PATH } from "../../src/lib/drive-relay/ws-node";
import {
  claimDriveRelayToken,
  createDriveRelaySession,
  joinDriveRelayByPairingCode,
  peekClaimToken,
} from "../../src/lib/drive-relay/store";

const PORT = Number(process.env.PORT ?? process.env.DRIVE_RELAY_PORT ?? 8787);
const INTERNAL_SECRET = process.env.DRIVE_RELAY_INTERNAL_SECRET?.trim() ?? "";
const ALLOWED_ORIGINS = (process.env.DRIVE_RELAY_ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "600",
  };
}

function authorizeInternal(req: { headers: { authorization?: string | string[] | undefined } }) {
  if (!INTERNAL_SECRET) return true;
  const h = req.headers.authorization;
  const value = Array.isArray(h) ? h[0] : h;
  return value === `Bearer ${INTERNAL_SECRET}`;
}

async function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 16_384) throw new Error("body-too-large");
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
  origin?: string,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const actorKey = req.socket.remoteAddress ?? "unknown";

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, service: "elcamoso-drive-relay", ws: RELAY_WS_PATH }, origin);
    return;
  }

  if (!authorizeInternal(req) && url.pathname.startsWith("/v1/")) {
    send(res, 401, { ok: false, error: "unauthorized" }, origin);
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/v1/session/create") {
      const created = createDriveRelaySession();
      send(res, 200, created, origin);
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/session/claim") {
      const body = (await readJson(req)) as { claimToken?: string };
      const claimed = claimDriveRelayToken(String(body.claimToken ?? ""), actorKey);
      if (!claimed) {
        send(res, 200, { ok: false }, origin);
        return;
      }
      send(
        res,
        200,
        {
          ok: true,
          sessionId: claimed.sessionId,
          joinSecret: claimed.joinSecret,
          expiresAt: claimed.expiresAt,
        },
        origin,
      );
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/session/join-code") {
      const body = (await readJson(req)) as { pairingCode?: string };
      const joined = joinDriveRelayByPairingCode(String(body.pairingCode ?? ""), actorKey);
      if (!joined) {
        send(res, 200, { ok: false }, origin);
        return;
      }
      send(
        res,
        200,
        {
          ok: true,
          sessionId: joined.sessionId,
          joinSecret: joined.joinSecret,
          expiresAt: joined.expiresAt,
        },
        origin,
      );
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/session/peek-claim") {
      const body = (await readJson(req)) as { claimToken?: string };
      const peek = peekClaimToken(String(body.claimToken ?? ""));
      if (!peek) {
        send(res, 200, { ok: false }, origin);
        return;
      }
      send(
        res,
        200,
        {
          ok: true,
          expired: peek.expired,
          used: peek.used,
          phoneConnected: peek.phoneConnected,
        },
        origin,
      );
      return;
    }
  } catch {
    send(res, 400, { ok: false, error: "bad-request" }, origin);
    return;
  }

  if (url.pathname === RELAY_WS_PATH) {
    send(res, 426, { ok: false, error: "upgrade-required" }, origin);
    return;
  }

  send(res, 404, { ok: false, error: "not-found" }, origin);
});

attachRelayWsUpgrade(server);

server.listen(PORT, () => {
  console.log(`[drive-relay] listening on :${PORT} ws=${RELAY_WS_PATH}`);
});
