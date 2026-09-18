import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.elcamoso.app",
  appName: "ELCAMOSO",
  // TanStack Start is SSR. The bundled shell gives Capacitor a valid offline
  // entry point; native app builds load the trusted deployment selected through
  // CAPACITOR_SERVER_URL until a dedicated static client build is introduced.
  webDir: "native-shell",
  server: process.env.CAPACITOR_SERVER_URL
    ? {
        url: process.env.CAPACITOR_SERVER_URL,
        cleartext: process.env.CAPACITOR_SERVER_URL.startsWith("http://"),
      }
    : undefined,
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
