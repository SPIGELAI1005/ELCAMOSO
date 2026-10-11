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
  requestEmailOtpFn,
  verifyEmailOtpFn,
  getEmailOtpStatusFn,
  signOutAccountFn,
  verifyAccountMagicLinkFn,
} from "@/lib/account/server-fns";
export {
  getAccountSession,
  getGoogleSignInAvailability,
  getEmailOtpAvailability,
  beginGoogleSignIn,
  completeGoogleSignIn,
  isValidAccountEmail,
  normalizeAccountEmail,
  requireAccountSession,
  requestAccountSignIn,
  requestEmailOtp,
  verifyEmailOtp,
  createSessionFromVerifiedEmail,
  signOutAccount,
  verifyAccountMagicLink,
  sanitizeReturnTo,
} from "@/lib/account/auth-service";
export { isGoogleOAuthConfigured } from "@/lib/account/google-oauth-config";
export { isEmailOtpConfigured } from "@/lib/account/supabase-config";
export { resolveAuthenticatedUserId } from "@/lib/account/resolve-authenticated-user";
export {
  accountSessionToSettingsPatch,
  clearAccountSettingsPatch,
  clearPersistedAccountSession,
  readPersistedAccountSession,
  writePersistedAccountSession,
} from "@/lib/account/persist";
export { ACCOUNT_SYNC_CHANNEL, ACCOUNT_SYNC_STORAGE_KEY } from "@/lib/account/account-sync";
