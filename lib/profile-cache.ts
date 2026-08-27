import * as SecureStore from "expo-secure-store";

const profileKey = "athlete-tracker.profile";
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function readProfileCache(): string | null {
  return SecureStore.getItem(profileKey, secureOptions);
}

export function writeProfileCache(value: string): void {
  SecureStore.setItem(profileKey, value, secureOptions);
}

export function clearProfileCache(): void {
  // SecureStore has no synchronous delete. A tombstone prevents a late async
  // deletion from racing with a fresh profile write.
  SecureStore.setItem(profileKey, "", secureOptions);
}
