import {
  clearLegacyTournamentDraft,
  draftStorage,
  tournamentDraftStorageKey,
} from "@/lib/storage";

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
