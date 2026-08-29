import { useRef } from "react";
import { useSyncExternalStore } from "react";
import { getSession, type SessionSnapshot } from "@/lib/drive/session";

let serverSessionSnapshot: SessionSnapshot | undefined;

function getServerSessionSnapshot(): SessionSnapshot {
  if (!serverSessionSnapshot) {
    serverSessionSnapshot = getSession().snapshot();
  }
  return serverSessionSnapshot;
}

export function useSessionStore(): SessionSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => getSession().subscribe(onStoreChange),
    () => getSession().snapshot(),
    getServerSessionSnapshot,
  );
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Subscribe to a derived slice so layout chrome does not re-render on RPM ticks. */
export function useSessionSelector<T extends object>(selector: (snap: SessionSnapshot) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cacheRef = useRef<T | undefined>(undefined);
  const serverCacheRef = useRef<T | undefined>(undefined);

  return useSyncExternalStore(
    (onStoreChange) => getSession().subscribe(onStoreChange),
    () => {
      const snap = getSession().snapshot();
      const next = selectorRef.current(snap);
      const prev = cacheRef.current;
      if (prev !== undefined && shallowEqual(prev, next)) return prev;
      cacheRef.current = next;
      return next;
    },
    () => {
      if (serverCacheRef.current === undefined) {
        serverCacheRef.current = selectorRef.current(getServerSessionSnapshot());
      }
      return serverCacheRef.current;
    },
  );
}

export { getSession };
