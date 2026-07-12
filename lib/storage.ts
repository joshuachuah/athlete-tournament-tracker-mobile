import "expo-sqlite/localStorage/install";

import type { AthleteProfile } from "@/types";

const profileKey = "athlete-tracker:profile";
const legacyTournamentDraftKey = "athlete-tracker:tournament-draft";

type StoredProfile = {
  version: 2;
  userId: string;
  profile: AthleteProfile;
};

function getJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const profileStorage = {
  get: () => getJson<StoredProfile>(profileKey)?.profile ?? null,
  getForUser: (userId: string) => {
    const stored = getJson<StoredProfile | AthleteProfile>(profileKey);

    if (
      stored &&
      "version" in stored &&
      stored.version === 2 &&
      stored.userId === userId
    ) {
      return stored.profile;
    }

    localStorage.removeItem(profileKey);
    return null;
  },
  set: (userId: string, profile: AthleteProfile) =>
    setJson<StoredProfile>(profileKey, { version: 2, userId, profile }),
  clear: () => localStorage.removeItem(profileKey),
};

export const draftStorage = {
  get: <T>(key: string) => getJson<T>(key),
  set: <T>(key: string, value: T) => setJson(key, value),
  clear: (key: string) => localStorage.removeItem(key),
};

export function tournamentDraftStorageKey(userId: string): string {
  return `${legacyTournamentDraftKey}:${userId}`;
}

export function clearLegacyTournamentDraft(): void {
  localStorage.removeItem(legacyTournamentDraftKey);
}
