import type { Plugin } from "vite";

/** Dev + preview WebSocket endpoint for shared Drive sessions. */
export function driveRelayWsPlugin(): Plugin {
  return {
    name: "elcamoso-drive-relay-ws",
    async configureServer(server) {
      const { attachRelayWsUpgrade } = await import("./ws-node");
      const httpServer = server.httpServer;
      if (httpServer) attachRelayWsUpgrade(httpServer);
    },
    async configurePreviewServer(server) {
      const { attachRelayWsUpgrade } = await import("./ws-node");
      const httpServer = server.httpServer;
      if (httpServer) attachRelayWsUpgrade(httpServer);
    },
  };
}
