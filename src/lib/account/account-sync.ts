/** Cross-tab account session sync (logout / expiry). */

export const ACCOUNT_SYNC_CHANNEL = "elcamoso.account.sync";
export const ACCOUNT_SYNC_STORAGE_KEY = "elcamoso.account.sync.event";

export type AccountSyncEvent =
  | { type: "signed-out"; at: number }
  | { type: "signed-in"; at: number; userId: string };

export function publishAccountSyncEvent(event: AccountSyncEvent): void {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(ACCOUNT_SYNC_CHANNEL);
    channel.postMessage(event);
    channel.close();
  } catch {
    /* BroadcastChannel unsupported */
  }
  try {
    // storage event reaches other tabs when BroadcastChannel is unavailable.
    localStorage.setItem(ACCOUNT_SYNC_STORAGE_KEY, JSON.stringify(event));
    localStorage.removeItem(ACCOUNT_SYNC_STORAGE_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}
