import "expo-sqlite/localStorage/install";

import * as SecureStore from "expo-secure-store";

const profileKey = "athlete-tracker.profile";
const profileCacheDisabledKey = "athlete-tracker.profile-cache-disabled";
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let cacheReadable = true;

function disableCacheReads(): void {
  cacheReadable = false;

  try {
    localStorage.setItem(profileCacheDisabledKey, "1");
  } catch {
    // The process-local flag still protects the current session.
  }
}

function enableCacheReads(): void {
  try {
    localStorage.removeItem(profileCacheDisabledKey);
    cacheReadable = true;
  } catch {
    cacheReadable = false;
  }
}

function canReadCache(): boolean {
  if (!cacheReadable) {
    return false;
  }

  try {
    return localStorage.getItem(profileCacheDisabledKey) !== "1";
  } catch {
    cacheReadable = false;
    return false;
  }
}

export function readProfileCache(): string | null {
  if (!canReadCache()) {
    return null;
  }

  try {
    return SecureStore.getItem(profileKey, secureOptions);
  } catch {
    disableCacheReads();
    return null;
  }
}

export function writeProfileCache(value: string): void {
  disableCacheReads();

  try {
    SecureStore.setItem(profileKey, value, secureOptions);
    enableCacheReads();
  } catch {
    // A cache failure must not turn a successful API request into an error.
  }
}

export function clearProfileCache(): void {
  disableCacheReads();

  // SecureStore has no synchronous delete. A tombstone prevents a late async
  // deletion from racing with a fresh profile write.
  try {
    SecureStore.setItem(profileKey, "", secureOptions);
  } catch {
    // Keep reads disabled so an old private profile cannot reappear later.
  }
}
