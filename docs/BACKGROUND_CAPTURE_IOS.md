# Background Capture — iOS

## Implemented behavior

`NativeJourneyCapturePlugin.swift` uses `CLLocationManager` with:

- `activityType = .automotiveNavigation`
- `allowsBackgroundLocationUpdates = true`
- `showsBackgroundLocationIndicator = true`
- `pausesLocationUpdatesAutomatically = false`
- standard location updates started only after a foreground user action

The app requests Always authorization for locked-screen capture. `Info.plist` contains both When In Use and Always-and-When-In-Use purpose strings plus `UIBackgroundModes/location`. No silent audio or audio background mode is present.

## Exact Xcode setup

Perform these steps on a Mac with Node 22+ and a current Xcode installation:

1. From the repository root, run `npm ci`.
2. Set the HTTPS app deployment used by this build: `export CAPACITOR_SERVER_URL=https://your-elcamoso-deployment.example`.
3. Run `npm run native:sync`.
4. Run `npm run native:ios`, or open `ios/App/App.xcodeproj` in Xcode.
5. Select the **App** target → **Signing & Capabilities**. Choose the correct Team and confirm bundle identifier `com.elcamoso.app` (or the approved production ID).
6. Add/confirm **Background Modes** and check only **Location updates**. Do not enable Audio.
7. Select `NativeJourneyCapturePlugin.swift` in the File inspector and confirm **Target Membership → App** is checked.
8. Select the **App** target → **Info** and verify the two location purpose strings exactly match `Info.plist`.
9. Connect a physical iPhone, select it as the run destination, then Build and Run.
10. In iOS Settings → Privacy & Security → Location Services → ELCAMOSO, confirm **Always** and **Precise Location** for the high-detail test. iOS may stage the upgrade from While Using to Always; follow the second system prompt or Settings flow.

Do not use a simulator as evidence of background reliability.

## Physical-device test matrix

Run each case in both Balanced and High Detail where noted. Record iPhone model, iOS version, start/end timestamps, battery delta, sample count, gaps, and whether the blue background-location indicator appeared.

| Case                       | Procedure                                      | Expected                                                             |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Permission denied          | Deny location, start capture                   | Start fails clearly; no active native file/service                   |
| Foreground baseline        | Capture a 10-minute mixed-speed drive          | Samples increase; no coordinates in exported trace                   |
| Screen locked              | Start foreground, lock for 15+ minutes, unlock | Capture remains active; duration includes lock period                |
| App backgrounded           | Start, switch apps for 15+ minutes             | Capture continues; background indicator is visible                   |
| Incoming call/interruption | Background during a short interruption         | Capture continues or records an honest gap                           |
| Low Power Mode             | Repeat a 15-minute drive                       | Trace remains valid; lower OS cadence is accepted and disclosed      |
| Poor GPS/tunnel            | Drive through degraded coverage                | Reduced confidence and `sensor_loss` gap; no invented samples        |
| Normal stop                | Tap Stop & Create Journey                      | Location updates stop promptly; one trace imports once               |
| Relaunch recovery          | Terminate process during capture, relaunch     | Partial trace imports as incomplete and UI says “Journey recovered.” |
| Force quit                 | Swipe app away while capturing                 | Capture is not promised to continue; recovery marks missing time     |
| 60-minute battery          | Compare Balanced vs High Detail                | Capture survives; High Detail is expected to use more battery        |

After each stop, use Xcode’s Debug Memory Graph and Instruments Energy Log/Leaks to confirm the `CLLocationManager` stops updating and the plugin is not duplicated across repeated sessions.

## App Store review notes

State plainly that the user starts a drive, motion is derived locally, routes are not saved, and background location is needed only to continue that active capture while locked. Include a short review video showing the consent screen, system permission, background indicator, active status on return, and Stop action. Store privacy answers must be reviewed against the complete production app.

Reference: [Apple — Handling location updates in the background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background).
