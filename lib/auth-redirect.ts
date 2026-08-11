export const LEGACY_AUTH_CALLBACK = "athletetracker://auth/callback";

export function oauthRedirectUri(): string {
  return LEGACY_AUTH_CALLBACK;
}
