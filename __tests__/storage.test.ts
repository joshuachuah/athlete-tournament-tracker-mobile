import * as SecureStore from "expo-secure-store";

import {
  clearLegacyTournamentDraft,
  draftStorage,
  profileStorage,
  tournamentDraftStorageKey,
} from "@/lib/storage";
import type { AthleteProfile } from "@/types";

function readProfileCacheAfterModuleReload(): string | null {
  let readProfileCache: () => string | null = () => "module did not reload";

  jest.isolateModules(() => {
    ({ readProfileCache } = jest.requireActual("@/lib/profile-cache"));
  });

  return readProfileCache();
}

jest.mock("expo-sqlite/localStorage/install", () => {
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  return {};
});

describe("tournament draft storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("isolates persisted drafts by authenticated user", () => {
    const firstKey = tournamentDraftStorageKey("athlete-1");
    const secondKey = tournamentDraftStorageKey("athlete-2");

    draftStorage.set(firstKey, { name: "First athlete draft" });
    draftStorage.set(secondKey, { name: "Second athlete draft" });

    expect(draftStorage.get(firstKey)).toEqual({
      name: "First athlete draft",
    });
    expect(draftStorage.get(secondKey)).toEqual({
      name: "Second athlete draft",
    });
  });

  it("removes drafts written under the legacy global key", () => {
    localStorage.setItem(
      "athlete-tracker:tournament-draft",
      JSON.stringify({ name: "Unscoped draft" }),
    );

    clearLegacyTournamentDraft();

    expect(localStorage.getItem("athlete-tracker:tournament-draft")).toBeNull();
  });
});

describe("profile storage", () => {
  const profile: AthleteProfile = {
    id: "athlete-1",
    email: "first@example.com",
    name: "First Athlete",
    home_country: "Malaysia",
    home_currency: "MYR",
    sport: "Tennis",
    monthly_income: 2_000,
    savings_balance: 5_000,
    monthly_sponsorship: 500,
    created_at: "2026-01-01",
  };

  beforeEach(() => {
    localStorage.clear();
    (
      SecureStore as typeof SecureStore & { __reset: () => void }
    ).__reset();
  });

  it("returns a profile cached for the authenticated subject", () => {
    profileStorage.set("user-1", profile);

    expect(profileStorage.getForUser("user-1")).toEqual(profile);
  });

  it("clears a profile cached for a different authenticated subject", () => {
    profileStorage.set("user-1", profile);

    expect(profileStorage.getForUser("user-2")).toBeNull();
    expect(profileStorage.get()).toBeNull();
  });

  it("clears the legacy email-only profile cache", () => {
    localStorage.setItem("athlete-tracker:profile", JSON.stringify(profile));

    expect(profileStorage.getForUser("user-1")).toBeNull();
    expect(localStorage.getItem("athlete-tracker:profile")).toBeNull();
  });

  it.each(["\"corrupt\"", "1", "true"])(
    "clears a primitive profile cache value %s",
    async (storedValue) => {
      SecureStore.setItem("athlete-tracker.profile", storedValue);

      expect(profileStorage.getForUser("user-1")).toBeNull();
      expect(SecureStore.getItem("athlete-tracker.profile")).toBe("");
    },
  );

  it.each([
    ["malformed JSON", "{"],
    ["an array root", "[]"],
    [
      "a null profile field",
      JSON.stringify({ version: 2, userId: "user-1", profile: null }),
    ],
    [
      "a wrong-typed profile field",
      JSON.stringify({
        version: 2,
        userId: "user-1",
        profile: { ...profile, monthly_income: "2000" },
      }),
    ],
    [
      "an unknown wrapper version",
      JSON.stringify({ version: 3, userId: "user-1", profile }),
    ],
  ])("clears %s", async (_label, storedValue) => {
    SecureStore.setItem("athlete-tracker.profile", storedValue);

    expect(profileStorage.getForUser("user-1")).toBeNull();
    expect(SecureStore.getItem("athlete-tracker.profile")).toBe("");
  });

  it("validates profile data for unscoped reads too", async () => {
    SecureStore.setItem(
      "athlete-tracker.profile",
      JSON.stringify({
        version: 2,
        userId: "user-1",
        profile: { ...profile, home_currency: null },
      }),
    );

    expect(profileStorage.get()).toBeNull();
    expect(SecureStore.getItem("athlete-tracker.profile")).toBe("");
  });

  it("never writes the profile to localStorage", () => {
    profileStorage.set("user-1", profile);

    const storedProfile = SecureStore.getItem("athlete-tracker.profile");

    expect(localStorage.getItem("athlete-tracker:profile")).toBeNull();
    expect(localStorage.getItem("athlete-tracker.profile")).toBeNull();
    expect(storedProfile).toContain('"savings_balance"');
    expect(storedProfile?.length).toBeLessThanOrEqual(2_048);
  });

  it("continues without a cache when protected data cannot be read", () => {
    jest.spyOn(SecureStore, "getItem").mockImplementationOnce(() => {
      throw new Error("Protected data is unavailable");
    });

    expect(profileStorage.getForUser("user-1")).toBeNull();
  });

  it("does not expose an old profile after a replacement write fails", () => {
    profileStorage.set("user-1", profile);
    const setItem = jest.spyOn(SecureStore, "setItem").mockImplementationOnce(() => {
      throw new Error("Value exceeds the Keychain limit");
    });

    expect(() =>
      profileStorage.set("user-1", { ...profile, name: "Updated Athlete" }),
    ).not.toThrow();
    setItem.mockRestore();

    expect(profileStorage.getForUser("user-1")).toBeNull();
    expect(readProfileCacheAfterModuleReload()).toBeNull();
  });

  it("does not expose an old profile after its tombstone write fails", () => {
    profileStorage.set("user-1", profile);
    const setItem = jest.spyOn(SecureStore, "setItem").mockImplementationOnce(() => {
      throw new Error("Protected data is unavailable");
    });

    expect(() => profileStorage.clear()).not.toThrow();
    setItem.mockRestore();

    expect(profileStorage.getForUser("user-1")).toBeNull();
    expect(readProfileCacheAfterModuleReload()).toBeNull();
  });
});
