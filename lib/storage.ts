import "expo-sqlite/localStorage/install";

import * as SecureStore from "expo-secure-store";

import { z } from "zod";

import { athleteProfileSchema } from "@/lib/api-schemas";
import type { AthleteProfile } from "@/types";

const profileKey = "athlete-tracker.profile";
const legacyPlaintextProfileKey = "athlete-tracker:profile";
const legacyTournamentDraftKey = "athlete-tracker:tournament-draft";
const draftClearVersions = new Map<string, number>();

const storedProfileSchema = z.strictObject({
  version: z.literal(2),
  userId: z.string(),
  profile: athleteProfileSchema,
});

type StoredProfile = z.infer<typeof storedProfileSchema>;

function getJson(key: string): unknown | null {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function getSecureJson(key: string): unknown | null {
  const raw = SecureStore.getItem(key, secureOptions);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    SecureStore.setItem(key, "", secureOptions);
    return null;
  }
}

function setSecureJson<T>(key: string, value: T): void {
  SecureStore.setItem(key, JSON.stringify(value), secureOptions);
}

function clearSecure(key: string): void {
  // SecureStore has no synchronous delete. A synchronous tombstone prevents a
  // late async deletion from racing with a fresh profile write.
  SecureStore.setItem(key, "", secureOptions);
}

/**
 * Cached in SecureStore, not localStorage: the profile carries private finance
 * values. Synchronous on purpose; the auth bootstrap reads it during the first
 * render.
 */
export const profileStorage = {
  get: () => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    const result = storedProfileSchema.safeParse(getSecureJson(profileKey));

    if (result.success) {
      return result.data.profile;
    }

    clearSecure(profileKey);
    return null;
  },
  getForUser: (userId: string) => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    const result = storedProfileSchema.safeParse(getSecureJson(profileKey));

    if (result.success && result.data.userId === userId) {
      return result.data.profile;
    }

    clearSecure(profileKey);
    return null;
  },
  set: (userId: string, profile: AthleteProfile) => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    setSecureJson<StoredProfile>(profileKey, { version: 2, userId, profile });
  },
  clear: () => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    clearSecure(profileKey);
  },
};

export const draftStorage = {
  get: (key: string) => getJson(key),
  set: <T>(key: string, value: T) => setJson(key, value),
  clear: (key: string) => {
    localStorage.removeItem(key);
    draftClearVersions.set(key, (draftClearVersions.get(key) ?? 0) + 1);
  },
  clearVersion: (key: string) => draftClearVersions.get(key) ?? 0,
};

export function tournamentDraftStorageKey(userId: string): string {
  return `${legacyTournamentDraftKey}:${userId}`;
}

export function clearLegacyTournamentDraft(): void {
  localStorage.removeItem(legacyTournamentDraftKey);
}
