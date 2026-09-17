export type { User } from "@/lib/account/types";
export {
  AccountProvider,
  useAccount,
  type AccountContextValue,
} from "@/lib/account/AccountProvider";
export {
  getAccountSessionFn,
  getGoogleSignInStatusFn,
  beginGoogleSignInFn,
  completeGoogleSignInFn,
  requestAccountSignInFn,
  signOutAccountFn,
  verifyAccountMagicLinkFn,
} from "@/lib/account/server-fns";
export {
  getAccountSession,
  getGoogleSignInAvailability,
  beginGoogleSignIn,
  completeGoogleSignIn,
  isValidAccountEmail,
  normalizeAccountEmail,
  requireAccountSession,
  requestAccountSignIn,
  signOutAccount,
  verifyAccountMagicLink,
} from "@/lib/account/auth-service";
export { isGoogleOAuthConfigured } from "@/lib/account/google-oauth-config";
export { resolveAuthenticatedUserId } from "@/lib/account/resolve-authenticated-user";
export {
  accountSessionToSettingsPatch,
  clearAccountSettingsPatch,
  clearPersistedAccountSession,
  readPersistedAccountSession,
  writePersistedAccountSession,
} from "@/lib/account/persist";
