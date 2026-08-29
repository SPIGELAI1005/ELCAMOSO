import { useCallback, useEffect, useRef, useState } from "react";
import { resolveGpsSpeed, type GpsPoint } from "@/lib/drive/gps-speed";
import type { MotionSample } from "@/lib/motion/types";
import {
  applyAccelDeadband,
  buildPhoneMotionSample,
  clampAccelMs2,
  clampGyroDps,
  computeNoiseFloor,
  headingFromOrientation,
  PHONE_SENSOR_CALIBRATION_MS,
  PHONE_SENSOR_TICK_MS,
  type PhoneSensorFrame,
} from "@/lib/motion/phone-sensor-normalize";
import {
  detectPhoneSensorAvailability,
  motionRequiresUserGesture,
  PHONE_GPS_WATCH_OPTIONS,
  requestGeolocationPermission,
  requestMotionPermission,
  requestOrientationPermission,
  type PhoneSensorAvailability,
} from "@/lib/motion/phone-sensor-permissions";
import {
  computeSignalHealth,
  type PhoneCalibrationStatus,
  type PhoneGpsStatus,
  type PhoneMotionStatus,
  type PhoneSensorStatusSnapshot,
} from "@/lib/motion/phone-sensor-status";

export interface PhoneSensorClientOptions {
  enabled: boolean;
  onSample: (sample: MotionSample) => void;
  sensitivity?: number;
  initialNoiseFloor?: number;
}

export interface PhoneSensorClientHandle {
  status: PhoneSensorStatusSnapshot;
  /** iOS / denied: call from a button tap to request sensor access. */
  requestAccess: () => Promise<void>;
  needsPermissionPrompt: boolean;
}

export function usePhoneSensorClient({
  enabled,
  onSample,
  sensitivity = 1,
  initialNoiseFloor = 0,
}: PhoneSensorClientOptions): PhoneSensorClientHandle {
  const availabilityRef = useRef<PhoneSensorAvailability>(detectPhoneSensorAvailability());
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const [gpsStatus, setGpsStatus] = useState<PhoneGpsStatus>(
    availabilityRef.current.geolocation ? "searching" : "unavailable",
  );
  const [motionStatus, setMotionStatus] = useState<PhoneMotionStatus>(
    availabilityRef.current.motion ? "calibrating" : "unavailable",
  );
  const [calibration, setCalibration] = useState<PhoneCalibrationStatus>("pending");
  const [gpsAgeMs, setGpsAgeMs] = useState<number | null>(null);
  const [motionAgeMs, setMotionAgeMs] = useState<number | null>(null);
  const [sendHz, setSendHz] = useState(0);
  const [sensorsActive, setSensorsActive] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);

  const noiseFloorRef = useRef(initialNoiseFloor);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const calSamplesRef = useRef<number[]>([]);
  const calStartedRef = useRef<number | null>(null);
  const gpsPointRef = useRef<GpsPoint | null>(null);
  const frameRef = useRef<PhoneSensorFrame>({
    speedMs: 0,
    accelLong: 0,
    accelLat: 0,
    heading: null,
    accuracyM: null,
    gyroX: null,
    gyroY: null,
    gyroZ: null,
    gpsAt: 0,
    imuAt: 0,
  });
  const sendsRef = useRef<number[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const motionHandlerRef = useRef<(event: DeviceMotionEvent) => void>(() => {});
  const orientationHandlerRef = useRef<(event: DeviceOrientationEvent) => void>(() => {});

  const availability = availabilityRef.current;
  const needsPermissionPrompt =
    enabled &&
    !sensorsActive &&
    (motionRequiresUserGesture() || gpsStatus === "denied" || motionStatus === "denied") &&
    (availability.geolocation || availability.motion);

  const signalHealth = computeSignalHealth({
    relayConnected: enabled,
    gpsAgeMs,
    motionAgeMs,
    sendHz,
    motionAvailable: availability.motion,
  });

  const status: PhoneSensorStatusSnapshot = {
    availability,
    gps: gpsStatus,
    motion: motionStatus,
    calibration,
    signalHealth,
    gpsAgeMs,
    motionAgeMs,
    sendHz,
  };

  const stopSensors = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    window.removeEventListener("devicemotion", motionHandlerRef.current);
    window.removeEventListener("deviceorientation", orientationHandlerRef.current);
    setSensorsActive(false);
    setSendHz(0);
  }, []);

  const startSensors = useCallback(() => {
    stopSensors();
    setSensorsActive(true);
    calStartedRef.current = performance.now();
    calSamplesRef.current = [];
    setCalibration(availability.motion ? "calibrating" : "skipped");
    if (availability.motion) setMotionStatus("calibrating");

    motionHandlerRef.current = (event: DeviceMotionEvent) => {
      const now = performance.now();
      const a = event.acceleration ?? event.accelerationIncludingGravity;
      const r = event.rotationRate;
      const frame = frameRef.current;
      const sens = sensitivityRef.current;
      const floor = noiseFloorRef.current;

      if (a) {
        const rawY = clampAccelMs2((a.y ?? 0) * sens);
        const rawX = clampAccelMs2((a.x ?? 0) * sens);
        frame.accelLong = applyAccelDeadband(rawY, floor);
        frame.accelLat = applyAccelDeadband(rawX, floor);
        frame.imuAt = now;

        if (calStartedRef.current !== null) {
          const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
          if (Number.isFinite(mag)) calSamplesRef.current.push(mag);
        }
      }

      if (r) {
        frame.gyroX = clampGyroDps(r.alpha ?? null);
        frame.gyroY = clampGyroDps(r.beta ?? null);
        frame.gyroZ = clampGyroDps(r.gamma ?? null);
      }

      if (
        calStartedRef.current !== null &&
        now - calStartedRef.current >= PHONE_SENSOR_CALIBRATION_MS
      ) {
        noiseFloorRef.current = computeNoiseFloor(calSamplesRef.current, initialNoiseFloor);
        calStartedRef.current = null;
        setCalibration("ready");
        if (availability.motion) setMotionStatus("live");
      }
    };

    orientationHandlerRef.current = (event: DeviceOrientationEvent) => {
      const heading = headingFromOrientation(event);
      if (heading !== null) frameRef.current.heading = heading;
    };

    if (availability.motion) {
      window.addEventListener("devicemotion", motionHandlerRef.current, { passive: true });
    }
    if (availability.orientation) {
      window.addEventListener("deviceorientation", orientationHandlerRef.current, {
        passive: true,
      });
    }

    if (availability.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = performance.now();
          const resolved = resolveGpsSpeed({
            reportedSpeed: pos.coords.speed,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            atMs: pos.timestamp || Date.now(),
            previous: gpsPointRef.current,
            accuracyM: pos.coords.accuracy,
          });
          gpsPointRef.current = resolved.point;
          const frame = frameRef.current;
          frame.speedMs = resolved.speed;
          frame.gpsAt = now;
          frame.accuracyM = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null;
          if (typeof pos.coords.heading === "number" && Number.isFinite(pos.coords.heading)) {
            frame.heading = pos.coords.heading;
          }
          setGpsAgeMs(0);
          setGpsStatus(pos.coords.accuracy > 35 ? "weak" : "live");
        },
        () => setGpsStatus("denied"),
        PHONE_GPS_WATCH_OPTIONS,
      );
    }

    tickRef.current = window.setInterval(() => {
      const now = performance.now();
      const frame = frameRef.current;
      setGpsAgeMs(frame.gpsAt ? now - frame.gpsAt : null);
      setMotionAgeMs(frame.imuAt ? now - frame.imuAt : null);

      const sample = buildPhoneMotionSample(frame, now);
      if (!sample) return;
      onSampleRef.current(sample);

      const t = Date.now();
      sendsRef.current.push(t);
      sendsRef.current = sendsRef.current.filter((x) => t - x < 1000);
      setSendHz(sendsRef.current.length);
    }, PHONE_SENSOR_TICK_MS);
  }, [availability, initialNoiseFloor, stopSensors]);

  const requestAccess = useCallback(async () => {
    setAccessRequested(true);
    const avail = availabilityRef.current;

    if (!avail.geolocation && !avail.motion) {
      setGpsStatus("unavailable");
      setMotionStatus("unavailable");
      setCalibration("skipped");
      return;
    }

    let geoOk = !avail.geolocation;
    let motionOk = !avail.motion;

    if (avail.geolocation) {
      setGpsStatus("searching");
      geoOk = await requestGeolocationPermission();
      if (!geoOk) setGpsStatus("denied");
    }

    if (avail.motion) {
      motionOk = await requestMotionPermission();
      if (!motionOk) {
        setMotionStatus("denied");
        setCalibration("skipped");
      }
    }

    if (avail.orientation) {
      await requestOrientationPermission();
    }

    if (geoOk || motionOk) startSensors();
  }, [startSensors]);

  useEffect(() => {
    if (!enabled) {
      stopSensors();
      setAccessRequested(false);
      return;
    }

    if (motionRequiresUserGesture() && !accessRequested) {
      setCalibration("pending");
      if (availability.motion) setMotionStatus("calibrating");
      return;
    }

    void requestAccess();
    return stopSensors;
  }, [enabled, accessRequested, requestAccess, stopSensors, availability.motion]);

  return { status, requestAccess, needsPermissionPrompt };
}
