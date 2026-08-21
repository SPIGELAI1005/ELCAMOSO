import { useSyncExternalStore } from "react";
import { getSession, type SessionSnapshot } from "@/lib/drive/session";

export function useSessionStore(): SessionSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => getSession().subscribe(onStoreChange),
    () => getSession().snapshot(),
    () => getSession().snapshot(),
  );
}

export { getSession };
