# Native Companion Foundation

ELCAMOSO remains a TanStack Start web application. Capacitor 8.5.2 adds iOS and Android containers plus a narrow native motion-capture bridge; it is not a rewrite and does not move normal product logic out of React.

## Architecture

`src/lib/motion-capture/` is the platform boundary:

- `MotionCaptureProvider` is the normalized contract consumed by `DriveSession`.
- `WebMotionCaptureProvider` uses browser Geolocation and DeviceMotion. It is foreground/best-effort and records visibility gaps.
- `NativeMotionCaptureProvider` delegates durable capture to `NativeJourneyCapture`, while foreground samples still enter the existing sensor-fusion pipeline.
- `createMotionCaptureProvider()` is the only motion-capture runtime platform branch. Do not scatter `Capacitor.isNativePlatform()` checks through features.
- `native-import.ts` validates privacy, imports complete or recovered `JourneyTraceV1` records into IndexedDB, deduplicates by `journeyId`, then acknowledges native storage.

Native code derives speed, acceleration, jerk, confidence, and demand. Latitude/longitude exist only in OS location callback objects and the single previous in-memory fix used for distance/speed derivation. They are never serialized into active state, chunk files, completed traces, logs, analytics, or web storage.

## Packages and projects

- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`: 8.5.2
- `@capacitor/cli`: 8.5.2 (development dependency)
- App ID: `com.elcamoso.app`
- Native projects: `ios/` and `android/`
- Config: `capacitor.config.ts`
- Bundled fallback shell: `native-shell/index.html`

Commands:

```powershell
npm ci
npm run native:sync
npm run native:ios
npm run native:android
```

## TanStack Start and the native shell

TanStack Start currently emits an SSR Vercel application, not a static `index.html`. Capacitor requires a web assets directory with an `index.html`, so `native-shell/` is the valid bundled fallback. Current native development builds load the trusted deployed application explicitly:

```powershell
$env:CAPACITOR_SERVER_URL = "https://your-elcamoso-deployment.example"
npm run native:sync
```

The URL is copied into each native project by `cap sync`; it is not committed. Use HTTPS for release builds. Before store submission, product/security owners must choose and review either this hosted-web architecture or a dedicated static client build. The fallback shell intentionally does not impersonate the full product when no deployment is configured.

The existing `npm run build` and Vercel output are unchanged.

## Capture lifecycle

1. A visible React UI explains background capture and asks for a quality mode.
2. The user presses Continue. Only then does the native permission request occur.
3. `DriveSession` starts one provider with a new `journeyId`.
4. Native capture persists privacy-safe chunks independently of the WebView.
5. Returning to the app reads active duration, quality, distance, and sample count.
6. “Stop & Create Journey” finalizes the native trace and imports it into the normal Journey repository.
7. If the process or OS interrupted capture, the next native initialization finalizes an incomplete trace with a sensor-loss gap. React imports it and shows “Journey recovered.”

Quality modes:

- **Balanced (recommended):** lower location update frequency/distance sensitivity and lower expected battery use.
- **High detail:** best navigation accuracy with shorter update intervals and greater battery cost.

Native v1 deliberately uses background location as the reliable baseline. It reports reduced detail because it does not claim continuous background IMU access. Core Motion/accelerometer support may be added only where platform policy and actual device behavior support it; missing IMU detail must remain an explicit gap or reduced-detail capture, never fabricated data.

## Native storage

- iOS: Application Support / `NativeJourneys/active.json`, `chunks/<journeyId>/`, and `completed/<journeyId>.json`.
- Android: app-private files / `native-journeys/active.json`, `chunks/<journeyId>/`, and `completed/<journeyId>.json`.
- Active state is atomically replaced; sample chunks are written every 20 location samples.
- Completed files remain until web import acknowledges their IDs.
- The existing web repository remains IndexedDB and deduplicates native imports.
- Uninstalling the app removes app-private native data. No cloud upload is introduced.

## Known limitations

- Browser/PWA capture is still best-effort and cannot promise locked-screen continuation.
- Location update cadence is controlled by the OS; Balanced and High Detail are requests, not hard real-time rates.
- Native v1 has location-derived acceleration, not guaranteed continuous IMU, so sharp events can be less detailed in the background.
- Force-quitting on iOS stops standard background location delivery. Android/OEM task killers can also terminate a foreground service. Recovery preserves the available partial trace and marks a gap; it cannot reconstruct missing motion.
- The generated Android build requires a local JDK/Android SDK. The generated iOS project requires macOS/Xcode and cannot be compiled on Windows.

## Store-readiness considerations

- Apple review notes must explain the user-started drive-capture purpose, visible background indicator, local-only processing, and why Always location is required.
- Google Play Console must declare the location foreground-service use case. `ACCESS_BACKGROUND_LOCATION` is intentionally absent because the service is started while the activity is visible and then remains a foreground service.
- Privacy/Data Safety answers require owner/legal review. The implementation does not transmit coordinates or traces, but store disclosures must match all production analytics, sharing, and server behavior.
- Do not add silent audio playback, hidden restart loops, boot receivers, or background service starts to extend runtime.

Platform setup and physical validation are in [BACKGROUND_CAPTURE_IOS.md](BACKGROUND_CAPTURE_IOS.md) and [BACKGROUND_CAPTURE_ANDROID.md](BACKGROUND_CAPTURE_ANDROID.md).

Primary platform references: [Capacitor installation](https://capacitorjs.com/docs/getting-started), [Apple background location](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background), [Android foreground-service changes](https://developer.android.com/develop/background-work/services/fgs/changes), and [Android location service type](https://developer.android.com/develop/background-work/services/fgs/service-types#location).
