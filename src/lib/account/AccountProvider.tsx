import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ACCOUNT_SYNC_CHANNEL,
  ACCOUNT_SYNC_STORAGE_KEY,
  publishAccountSyncEvent,
  type AccountSyncEvent,
} from "@/lib/account/account-sync";
import {
  accountSessionToSettingsPatch,
  clearAccountSettingsPatch,
  clearPersistedAccountSession,
  readPersistedAccountSession,
  writePersistedAccountSession,
  type PersistedAccountSession,
} from "@/lib/account/persist";
import { getAccountSessionFn, signOutAccountFn } from "@/lib/account/server-fns";
import { useSettings } from "@/lib/drive/useSettings";

export interface AccountContextValue {
  session: PersistedAccountSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  saveSession: (session: PersistedAccountSession) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const [session, setSession] = useState<PersistedAccountSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveSession = useCallback(
    (next: PersistedAccountSession) => {
      writePersistedAccountSession(next);
      setSession(next);
      // Preferences / account ids only — never starts Drive audio.
      update(accountSessionToSettingsPatch(next));
      publishAccountSyncEvent({ type: "signed-in", at: Date.now(), userId: next.userId });
    },
    [update],
  );

  const refresh = useCallback(async () => {
    try {
      // Session authenticity comes from the HttpOnly cookie; localStorage is profile UX only.
      const result = await getAccountSessionFn({ data: {} });
      if (!result.authenticated) {
        clearPersistedAccountSession();
        setSession(null);
        update(clearAccountSettingsPatch());
        return;
      }
      const next: PersistedAccountSession = {
        userId: result.userId,
        email: result.email,
        expiresAt: result.expiresAt,
      };
      writePersistedAccountSession(next);
      setSession(next);
      update(accountSessionToSettingsPatch(next));
    } catch {
      const persisted =
        readPersistedAccountSession() ??
        (settings.accountUserId && settings.accountEmail
          ? {
              userId: settings.accountUserId,
              email: settings.accountEmail,
              expiresAt: Date.now() + 60_000,
            }
          : null);
      setSession(persisted);
    } finally {
      setIsLoading(false);
    }
  }, [settings.accountEmail, settings.accountUserId, update]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-check the HttpOnly cookie when returning from OAuth / another tab / focus.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Logout and session changes across open tabs.
  useEffect(() => {
    function applySync(event: AccountSyncEvent) {
      if (event.type === "signed-out") {
        clearPersistedAccountSession();
        setSession(null);
        update(clearAccountSettingsPatch());
        return;
      }
      if (event.type === "signed-in") void refresh();
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(ACCOUNT_SYNC_CHANNEL);
      channel.onmessage = (message) => {
        const data = message.data as AccountSyncEvent | undefined;
        if (data?.type) applySync(data);
      };
    } catch {
      channel = null;
    }

    function onStorage(ev: StorageEvent) {
      if (ev.key !== ACCOUNT_SYNC_STORAGE_KEY || !ev.newValue) return;
      try {
        applySync(JSON.parse(ev.newValue) as AccountSyncEvent);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh, update]);

  // Local expiry handling — server cookie remains authoritative on the next refresh.
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    if (ms <= 0) {
      clearPersistedAccountSession();
      setSession(null);
      update(clearAccountSettingsPatch());
      return;
    }
    const timer = window.setTimeout(() => {
      void refresh();
    }, Math.min(ms + 50, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [refresh, session, update]);

  const signOut = useCallback(async () => {
    try {
      await signOutAccountFn({ data: {} });
    } catch {
      // Local sign-out still clears client state.
    }
    clearPersistedAccountSession();
    setSession(null);
    update(clearAccountSettingsPatch());
    publishAccountSyncEvent({ type: "signed-out", at: Date.now() });
  }, [update]);

  const value = useMemo(
    (): AccountContextValue => ({
      session,
      isAuthenticated: session != null,
      isLoading,
      saveSession,
      signOut,
      refresh,
    }),
    [isLoading, refresh, saveSession, session, signOut],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
