import { render } from "@testing-library/react-native";

import { LegacyTournamentRedirect } from "@/components/tournament/legacy-tournament-redirect";
import { TournamentDraftProvider } from "@/context/tournament-draft";
import {
  createDefaultTournamentDraft,
  persistedTournamentDraft,
} from "@/lib/tournament-draft";
import { draftStorage, tournamentDraftStorageKey } from "@/lib/storage";

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: unknown }) =>
      React.createElement(Text, { testID: "redirect-href" }, JSON.stringify(href)),
  };
});

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

describe("LegacyTournamentRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("forwards a restored persisted edit id to the canonical form", () => {
    draftStorage.set(
      tournamentDraftStorageKey("athlete-1"),
      persistedTournamentDraft({
        ...createDefaultTournamentDraft(new Date(2026, 0, 1)),
        editId: "tournament-1",
        name: "Restored edit",
      }),
    );

    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <LegacyTournamentRedirect />
      </TournamentDraftProvider>,
    );

    expect(screen.getByTestId("redirect-href").props.children).toBe(
      JSON.stringify({
        pathname: "/tournaments/new/details",
        params: { editId: "tournament-1" },
      }),
    );
  });

  it("routes a new draft without adding an edit id", () => {
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <LegacyTournamentRedirect />
      </TournamentDraftProvider>,
    );

    expect(screen.getByTestId("redirect-href").props.children).toBe(
      JSON.stringify("/tournaments/new/details"),
    );
  });
});
