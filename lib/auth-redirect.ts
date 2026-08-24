export const CUSTOM_SCHEME_AUTH_CALLBACK = "athletetracker://auth/callback";

/**
 * SDK 54 can leave HTTPS auth sessions unresolved on iOS. Use the registered
 * custom scheme until the universal-link flow is upgraded and device-tested.
 */
export function oauthRedirectUri(): string {
  return CUSTOM_SCHEME_AUTH_CALLBACK;
}

export function isExpectedAuthCallback(
  callback: URL,
  expectedCallbackUrl: string,
): boolean {
  const expectedCallback = new URL(expectedCallbackUrl);

  return (
    callback.protocol === expectedCallback.protocol &&
    callback.username === expectedCallback.username &&
    callback.password === expectedCallback.password &&
    callback.hostname === expectedCallback.hostname &&
    callback.port === expectedCallback.port &&
    callback.pathname === expectedCallback.pathname
  );
}
