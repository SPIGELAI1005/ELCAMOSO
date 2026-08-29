export interface PhoneSensorAvailability {
  geolocation: boolean;
  motion: boolean;
  orientation: boolean;
}

type MotionCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

export function detectPhoneSensorAvailability(): PhoneSensorAvailability {
  return {
    geolocation: typeof navigator !== "undefined" && "geolocation" in navigator,
    motion: typeof window !== "undefined" && "DeviceMotionEvent" in window,
    orientation: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
  };
}

/** iOS 13+ requires a user gesture before motion events fire. */
export function motionRequiresUserGesture(): boolean {
  if (typeof window === "undefined") return false;
  const DM = window.DeviceMotionEvent as MotionCtor | undefined;
  return typeof DM?.requestPermission === "function";
}

export function orientationRequiresUserGesture(): boolean {
  if (typeof window === "undefined") return false;
  const DO = window.DeviceOrientationEvent as OrientationCtor | undefined;
  return typeof DO?.requestPermission === "function";
}

export async function requestMotionPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const DM = window.DeviceMotionEvent as MotionCtor | undefined;
  if (!DM) return false;
  if (typeof DM.requestPermission !== "function") return true;
  try {
    return (await DM.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const DO = window.DeviceOrientationEvent as OrientationCtor | undefined;
  if (!DO) return false;
  if (typeof DO.requestPermission !== "function") return true;
  try {
    return (await DO.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 500,
  timeout: 12_000,
};

export function requestGeolocationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      GPS_OPTIONS,
    );
  });
}

export const PHONE_GPS_WATCH_OPTIONS = GPS_OPTIONS;
