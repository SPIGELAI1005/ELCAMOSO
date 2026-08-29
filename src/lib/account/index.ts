export type { User } from "@/lib/account/types";
export { AccountProvider, useAccount, type AccountContextValue } from "@/lib/account/AccountProvider";
export {
  getAccountSessionFn,
  requestAccountSignInFn,
  signOutAccountFn,
  verifyAccountMagicLinkFn,
} from "@/lib/account/server-fns";
export { resolveAuthenticatedUserId } from "@/lib/account/resolve-authenticated-user";
export {
  getAccountSession,
  isValidAccountEmail,
  normalizeAccountEmail,
  requireAccountSession,
  requestAccountSignIn,
  signOutAccount,
  verifyAccountMagicLink,
} from "@/lib/account/auth-service";
export {
  accountSessionToSettingsPatch,
  clearAccountSettingsPatch,
  clearPersistedAccountSession,
  readPersistedAccountSession,
  writePersistedAccountSession,
} from "@/lib/account/persist";
