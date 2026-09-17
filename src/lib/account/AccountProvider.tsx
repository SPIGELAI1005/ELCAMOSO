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
      update(accountSessionToSettingsPatch(next));
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

  const signOut = useCallback(async () => {
    try {
      await signOutAccountFn({ data: {} });
    } catch {
      // Local sign-out still clears client state.
    }
    clearPersistedAccountSession();
    setSession(null);
    update(clearAccountSettingsPatch());
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
