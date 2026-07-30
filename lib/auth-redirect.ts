import { Platform } from "react-native";

export const HTTPS_AUTH_CALLBACK =
  "https://web-production-2fa073.up.railway.app/auth/callback";
export const LEGACY_AUTH_CALLBACK = "athletetracker://auth/callback";

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
): string {
  return supportsHttpsAuthCallback(os, version)
    ? HTTPS_AUTH_CALLBACK
    : LEGACY_AUTH_CALLBACK;
}
