import "expo-sqlite/localStorage/install";

import type { AthleteProfile } from "@/types";

const profileKey = "athlete-tracker:profile";

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
  get: () => getJson<AthleteProfile>(profileKey),
  set: (profile: AthleteProfile) => setJson(profileKey, profile),
  clear: () => localStorage.removeItem(profileKey),
};

export const draftStorage = {
  get: <T>(key: string) => getJson<T>(key),
  set: <T>(key: string, value: T) => setJson(key, value),
  clear: (key: string) => localStorage.removeItem(key),
};
