# Background Capture — Android

## Implemented behavior

`JourneyCaptureService` is a non-exported, location-typed foreground service. It is started only from the visible Drive UI after location permission is granted. It immediately posts an ongoing notification titled exactly:

> ELCAMOSO is capturing this drive

The notification has a Stop action that finalizes the journey and removes the service. The manifest declares coarse/fine location, general foreground service, location foreground-service type, and notification permissions. It intentionally does not declare `ACCESS_BACKGROUND_LOCATION`: a user-started location foreground service is the supported normal flow, and Android forbids starting it from the background without additional eligibility/permission.

## Exact Android Studio setup

1. Install Android Studio with Android SDK 36 and a compatible JDK (JDK 17 is the baseline for this generated AGP 8 project).
2. From the repository root, run `npm ci`.
3. Set the HTTPS app deployment for this build in PowerShell: `$env:CAPACITOR_SERVER_URL = "https://your-elcamoso-deployment.example"`.
4. Run `npm run native:sync`.
5. Run `npm run native:android`, or open the `android/` directory in Android Studio.
6. Allow Gradle sync to install Gradle 8.14.3, Android Gradle Plugin 8.13.0 dependencies, and SDK 36.
7. Confirm the **app** run configuration and application ID `com.elcamoso.app`.
8. Inspect the merged manifest and confirm `.JourneyCaptureService`, `android:foregroundServiceType="location"`, `FOREGROUND_SERVICE_LOCATION`, and location permissions are present.
9. Connect a physical device with developer options/USB debugging enabled, then Run **app**.
10. On Android 13+, grant notification permission during the same user-started setup. Grant Precise location for the high-detail matrix.

The Windows workspace used to create this foundation had no `JAVA_HOME`, so native Gradle compilation must be completed in Android Studio/CI after configuring the JDK.

## Physical-device test matrix

Test at minimum a Pixel/AOSP device plus one aggressively managed OEM device (Samsung, Xiaomi, OnePlus, etc.). Record model, Android version, battery policy, start/end time, sample count, gaps, notification behavior, and battery delta.

| Case                      | Procedure                                       | Expected                                                                                       |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Permission denied         | Deny location, press Continue                   | Service does not start; no active trace                                                        |
| Notification denied (13+) | Deny notifications but grant location           | System foreground-service disclosure remains available; app explains device behavior if needed |
| Foreground baseline       | 10-minute mixed-speed drive                     | Notification visible; privacy-safe samples increase                                            |
| Screen locked             | Lock for 15+ minutes                            | Foreground service continues capture                                                           |
| App swiped from Recents   | Swipe UI away during capture                    | Service remains due to `stopWithTask=false`, subject to OEM policy                             |
| Notification Stop         | Tap Stop in notification                        | Trace finalizes, notification disappears, one journey imports on return                        |
| UI Stop                   | Tap Stop & Create Journey                       | Same finalization; no duplicate import                                                         |
| Process kill/relaunch     | Kill app/service with developer tools, relaunch | Partial trace recovers with gap and “Journey recovered.”                                       |
| Location disabled         | Disable system location mid-drive               | No invented data; recovery/final trace contains a gap                                          |
| Battery Saver/Doze        | Lock during a 30-minute capture                 | Service remains visible; reduced callback cadence is tolerated                                 |
| OEM restricted battery    | Repeat with app Restricted then Unrestricted    | Document OEM termination behavior; recovered trace remains valid                               |
| Android 12                | Start only while activity visible               | No `ForegroundServiceStartNotAllowedException`                                                 |
| Android 14/15/16          | Start foreground and lock                       | No service-type/permission `SecurityException`                                                 |
| 60-minute battery         | Compare both quality modes                      | Stable service; High Detail is expected to cost more battery                                   |

Use Android Studio Profiler and `adb shell dumpsys activity services com.elcamoso.app` to verify one service instance. Repeat start/stop at least 20 times and confirm no duplicate location listeners, notifications, pending completed files, or Web Audio graphs.

## Google Play considerations

- Complete the Play Console foreground-service declaration for the location use case and provide a video of the foreground start, ongoing notification, and Stop action.
- Do not add boot restart or hidden background-start behavior.
- Data Safety and location disclosures require product/legal review against the complete production app. Native capture itself processes location on-device and does not persist or transmit coordinates.

References: [Android foreground-service changes](https://developer.android.com/develop/background-work/services/fgs/changes), [location foreground-service requirements](https://developer.android.com/develop/background-work/services/fgs/service-types#location), and [location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions).
