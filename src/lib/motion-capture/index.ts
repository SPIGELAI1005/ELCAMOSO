import { Capacitor } from "@capacitor/core";
import { NativeMotionCaptureProvider } from "./native-provider";
import { WebMotionCaptureProvider } from "./web-provider";

export * from "./types";
export { importNativeJourneys } from "./native-import";

/** The only runtime platform branch for motion capture. */
export function createMotionCaptureProvider() {
  return Capacitor.isNativePlatform()
    ? new NativeMotionCaptureProvider()
    : new WebMotionCaptureProvider();
}
