import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/lib/drive/useSettings";
import {
  drainQueue,
  enqueueIfEnabled,
  installId,
  trackEvent,
  type AnalyticsEvent,
} from "@/lib/telemetry/analytics";
import { installCrashReporting, readCrashes } from "@/lib/telemetry/crashes";
import { ingestTelemetryFn } from "@/lib/cloud/telemetry-server-fn";

export function TelemetryBridge() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastGarage = useRef(false);

  useEffect(() => {
    installCrashReporting();
  }, []);

  useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<AnalyticsEvent>).detail;
      if (!detail) return;
      enqueueIfEnabled(settings.analyticsEnabled, detail);
    };
    window.addEventListener("elcamoso:analytics", onEvent);
    return () => window.removeEventListener("elcamoso:analytics", onEvent);
  }, [settings.analyticsEnabled]);

  useEffect(() => {
    if (pathname === "/garage" && !lastGarage.current) {
      lastGarage.current = true;
      trackEvent("garage_open");
    }
    if (pathname !== "/garage") lastGarage.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!settings.analyticsEnabled) return;
    const flush = () => {
      const events = drainQueue();
      const crashes = readCrashes().slice(-8);
      if (!events.length && !crashes.length) return;
      void ingestTelemetryFn({
        data: { installId: installId(), events, crashes },
      }).catch(() => {
        events.forEach((event) => enqueueIfEnabled(true, event));
      });
    };
    const timer = window.setInterval(flush, 20000);
    flush();
    return () => window.clearInterval(timer);
  }, [settings.analyticsEnabled]);

  return null;
}
