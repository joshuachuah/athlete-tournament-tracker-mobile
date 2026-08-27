import "expo-sqlite/localStorage/install";

import { z } from "zod";

import { athleteProfileSchema } from "@/lib/api-schemas";
import {
  clearProfileCache,
  readProfileCache,
  writeProfileCache,
} from "@/lib/profile-cache";
import type { AthleteProfile } from "@/types";

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

function getCachedProfileJson(): unknown | null {
  const raw = readProfileCache();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    clearProfileCache();
    return null;
  }
}

function setCachedProfileJson<T>(value: T): void {
  writeProfileCache(JSON.stringify(value));
}

/**
 * Cached in SecureStore, not localStorage: the profile carries private finance
 * values. Synchronous on purpose; the auth bootstrap reads it during the first
 * render.
 */
export const profileStorage = {
  get: () => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    const result = storedProfileSchema.safeParse(getCachedProfileJson());

    if (result.success) {
      return result.data.profile;
    }

    clearProfileCache();
    return null;
  },
  getForUser: (userId: string) => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    const result = storedProfileSchema.safeParse(getCachedProfileJson());

    if (result.success && result.data.userId === userId) {
      return result.data.profile;
    }

    clearProfileCache();
    return null;
  },
  set: (userId: string, profile: AthleteProfile) => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    setCachedProfileJson<StoredProfile>({ version: 2, userId, profile });
  },
  clear: () => {
    localStorage.removeItem(legacyPlaintextProfileKey);
    clearProfileCache();
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
