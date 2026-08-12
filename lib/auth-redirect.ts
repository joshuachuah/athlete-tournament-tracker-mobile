import { Platform } from "react-native";

export const HTTPS_AUTH_CALLBACK =
  "https://web-production-2fa073.up.railway.app/auth/callback";
export const CUSTOM_SCHEME_AUTH_CALLBACK = "athletetracker://auth/callback";

export function supportsHttpsAuthCallback(
  os: string,
  version: string | number,
): boolean {
  if (os !== "ios") {
    return false;
  }

  const [major = 0, minor = 0] = String(version)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

  return major > 17 || (major === 17 && minor >= 4);
}

export function oauthRedirectUri(
  os: string = Platform.OS,
  version: string | number = Platform.Version,
  isDevelopment: boolean = __DEV__,
): string {
  return !isDevelopment && supportsHttpsAuthCallback(os, version)
    ? HTTPS_AUTH_CALLBACK
    : CUSTOM_SCHEME_AUTH_CALLBACK;
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
