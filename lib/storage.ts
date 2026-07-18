import "expo-sqlite/localStorage/install";

import { z } from "zod";

import { athleteProfileSchema } from "@/lib/api-schemas";
import type { AthleteProfile } from "@/types";

const profileKey = "athlete-tracker:profile";
const legacyTournamentDraftKey = "athlete-tracker:tournament-draft";

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

export const profileStorage = {
  get: () => {
    const result = storedProfileSchema.safeParse(getJson(profileKey));

    if (result.success) {
      return result.data.profile;
    }

    localStorage.removeItem(profileKey);
    return null;
  },
  getForUser: (userId: string) => {
    const result = storedProfileSchema.safeParse(getJson(profileKey));

    if (result.success && result.data.userId === userId) {
      return result.data.profile;
    }

    localStorage.removeItem(profileKey);
    return null;
  },
  set: (userId: string, profile: AthleteProfile) =>
    setJson<StoredProfile>(profileKey, { version: 2, userId, profile }),
  clear: () => localStorage.removeItem(profileKey),
};

export const draftStorage = {
  get: (key: string) => getJson(key),
  set: <T>(key: string, value: T) => setJson(key, value),
  clear: (key: string) => localStorage.removeItem(key),
};

export function tournamentDraftStorageKey(userId: string): string {
  return `${legacyTournamentDraftKey}:${userId}`;
}

export function clearLegacyTournamentDraft(): void {
  localStorage.removeItem(legacyTournamentDraftKey);
}
