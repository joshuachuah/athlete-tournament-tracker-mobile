import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren, ReactElement } from "react";
import { Alert } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

import { TournamentProjectionBuilder } from "@/components/tournament/tournament-projection-builder";
import { TournamentIdentitySearch } from "@/components/tournament/tournament-identity-search";
import { TournamentDraftProvider } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import {
  completeTournamentSaveData,
  createDefaultTournamentDraft,
  saveTournamentDraft,
  tournamentDraftFromKnown,
  tournamentToDraft,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import type { TournamentWithPnL } from "@/types";

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

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(),
  usePreventRemove: jest.fn(),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

jest.mock("@/lib/api", () => ({
  api: {
    tournaments: {
      preview: jest.fn(),
      search: jest.fn(),
    },
  },
}));

const mockPreview = api.tournaments.preview as jest.Mock;
const mockSearch = api.tournaments.search as jest.Mock;
const mockUseNavigation = useNavigation as jest.MockedFunction<
  typeof useNavigation
>;
const mockUsePreventRemove = usePreventRemove as jest.MockedFunction<
  typeof usePreventRemove
>;
const mockDispatch = jest.fn();
const defaultDraft = createDefaultTournamentDraft(new Date(2026, 0, 1));
const validDraft = {
  ...defaultDraft,
  name: "Open Championship",
  location: "Detroit",
  country: "United States",
  prize_rounds: { ...defaultDraft.prize_rounds, qf: 500 },
};

const savedTournament: TournamentWithPnL = {
  id: "tournament-1",
  user_id: "athlete-1",
  name: "Open Championship",
  location: "Detroit",
  country: "United States",
  currency: "USD",
  start_date: "2026-01-01",
  end_date: "2026-01-03",
  duration_days: 3,
  entry_fee: 100,
  flight_cost: 200,
  accommodation_total: 300,
  daily_spending_cap: 80,
  coaching_cost: 50,
  misc_cost: 25,
  subsidy_by: null,
  subsidy_amount: 0,
  subsidy_covers: null,
  sponsorship_allocated: 40,
  prize_rounds: { qf: 500 },
  prize_tax_rate: 30,
  created_at: "2026-01-01",
  home_currency: "USD",
  pnl: {
    total_income_base: 40,
    total_expenses: 675,
    scenarios: [],
    break_even_round: null,
  },
};

function renderWithClient(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(element, { wrapper: Wrapper });
}

function renderBuilder(initialDraft = validDraft, onSubmit = jest.fn()) {
  return {
    onSubmit,
    screen: renderWithClient(
      <TournamentDraftProvider userId="account-1">
        <TournamentProjectionBuilder
          authenticatedUserId="account-1"
          homeCurrency="USD"
          initialDraft={initialDraft}
          onSubmit={onSubmit}
          profileId="athlete-1"
          sport="tennis"
        />
      </TournamentDraftProvider>,
    ),
  };
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockSearch.mockReset().mockResolvedValue([]);
  mockPreview.mockReset().mockResolvedValue({
    total_expenses: 0,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  mockDispatch.mockReset();
  mockUseNavigation.mockReturnValue({ dispatch: mockDispatch } as never);
  mockUsePreventRemove.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("TournamentProjectionBuilder", () => {
  it("keeps the inline action clear of the iOS native tab bar", () => {
    const { screen } = renderBuilder(validDraft);

    expect(screen.getByTestId("projection-builder-scroll").props.contentInset.bottom).toBe(64);
    expect(
      screen.getByTestId("projection-builder-scroll").props.contentContainerStyle
        .paddingBottom,
    ).toBe(0);
    expect(screen.getByTestId("projection-action-area")).toBeTruthy();
  });

  it("selects a known tournament inline and prefills its identity", async () => {
    mockSearch.mockResolvedValue([
      {
        id: "known-1",
        name: "Detroit Open",
        location: "Detroit",
        country: "United States",
        currency: "USD",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        prize_rounds: { qf: 600 },
      },
    ]);
    const { screen } = renderBuilder(defaultDraft);

    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Detroit");
    await advance(300);
    await waitFor(() => expect(screen.getByText("Detroit Open")).toBeTruthy());
    fireEvent.press(screen.getByText("Detroit Open"));

    expect(screen.getByText("Detroit")).toBeTruthy();
    expect(screen.queryByText("Outcome scenarios")).toBeNull();
    fireEvent.press(screen.getByText("Continue"));

    expect(screen.getByText("Outcome scenarios")).toBeTruthy();
    expect(screen.getByText("Up to +$600 USD")).toBeTruthy();
    expect(screen.getByText("Create projection")).toBeTruthy();
  });

  it("shows search loading and retryable error states inline", async () => {
    mockSearch.mockRejectedValue(new Error("Tournament search offline"));
    const { screen } = renderBuilder(defaultDraft);

    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Offline Open");
    await advance(300);

    await waitFor(() => expect(screen.getByText("Tournament search offline")).toBeTruthy());
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("creates an unmatched identity, continues to details, and submits", async () => {
    const { onSubmit, screen } = renderBuilder(defaultDraft);

    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Community Open");
    await advance(300);
    await waitFor(() =>
      expect(screen.getByText("Use “Community Open” as a new tournament")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Use “Community Open” as a new tournament"));
    expect(screen.queryByLabelText("Location")).toBeNull();
    fireEvent.press(screen.getByText("Continue"));
    fireEvent.press(screen.getByText("Complete tournament details"));
    fireEvent.changeText(screen.getByLabelText("Location"), "Kuala Lumpur");
    fireEvent.changeText(screen.getByLabelText("Country"), "Malaysia");
    fireEvent.press(screen.getByText("Apply tournament details"));
    fireEvent.press(screen.getByText("Add prize money"));
    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByText("Apply prize money"));
    fireEvent.press(screen.getByText("Create projection"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Community Open",
        location: "Kuala Lumpur",
        country: "Malaysia",
      }),
    );
  });

  it("opens the correct ledger editor and applies its signed impact", () => {
    const { screen } = renderBuilder(validDraft);

    fireEvent.press(screen.getByText("Travel and stay"));
    fireEvent.changeText(screen.getByLabelText("Flights (USD)"), "250");
    fireEvent.press(screen.getByText("Apply travel and stay"));

    expect(screen.getByText("−$250 USD")).toBeTruthy();
  });

  it("maps the universal assumption picker to persisted sponsorship", () => {
    const { screen } = renderBuilder(validDraft);

    fireEvent.press(screen.getByText("Add optional assumption"));
    fireEvent.changeText(screen.getByLabelText("Search assumptions"), "sponsor");
    fireEvent.press(screen.getByText("Sponsorship"));
    fireEvent.changeText(screen.getByLabelText("Sponsorship allocated (USD)"), "400");
    fireEvent.press(screen.getByText("Apply sponsorship"));

    expect(screen.getByText("+$400 USD")).toBeTruthy();
    expect(screen.getByText("Funding allocated to this tournament")).toBeTruthy();
  });

  it("uses the adaptive CTA to open and validate the first invalid editor", () => {
    const { screen } = renderBuilder({ ...validDraft, prize_tax_rate: 101 });

    expect(screen.getByText("Review prize money")).toBeTruthy();
    fireEvent.press(screen.getByText("Review prize money"));
    fireEvent.press(screen.getByText("Apply prize money"));

    expect(screen.getByText("Must be between 0 and 100.")).toBeTruthy();
  });

  it("does not submit a stale identity while a replacement search is unresolved", () => {
    const { onSubmit, screen } = renderBuilder(validDraft);

    fireEvent.press(screen.getByText("Change tournament"));
    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Replacement Open");
    expect(screen.getByText("Choose tournament")).toBeTruthy();
    fireEvent.press(screen.getByText("Choose tournament"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a known tournament or enter a new tournament name.")).toBeTruthy();
  });

  it("clears the previous tournament when choosing a new free-text identity", async () => {
    const previousDraft: TournamentDraft = {
      ...validDraft,
      location: "Paris",
      country: "France",
      currency: "EUR",
      entry_fee: 300,
      prize_distribution_mode: "generated",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 47_500,
      prize_rounds: { ...defaultDraft.prize_rounds, qf: 2_137.5 },
      prize_tax_rate: 30,
      flight_cost: 500,
      accommodation_total: 600,
      coaching_cost: 200,
      subsidy_enabled: true,
      subsidy_by: "Federation",
      subsidy_amount: 400,
      sponsorship_allocated: 250,
    };
    const onChangeDraft = jest.fn();
    const screen = renderWithClient(
      <TournamentIdentitySearch
        draft={previousDraft}
        inputRef={{ current: null }}
        onChangeDraft={onChangeDraft}
        onResolutionChange={jest.fn()}
        sport="tennis"
      />,
    );

    fireEvent.press(
      screen.getByLabelText(
        "Selected tournament Open Championship. Change selection",
      ),
    );
    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Community Open");
    await advance(300);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Create a new tournament named Community Open"),
      ).toBeTruthy(),
    );
    fireEvent.press(
      screen.getByLabelText("Create a new tournament named Community Open"),
    );

    expect(onChangeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Community Open",
        location: "",
        country: "",
        currency: "USD",
        entry_fee: 0,
        prize_rounds: defaultDraft.prize_rounds,
        prize_tax_rate: 0,
        flight_cost: 0,
        accommodation_total: 0,
        coaching_cost: 0,
        subsidy_by: "",
        subsidy_amount: 0,
        sponsorship_allocated: 0,
        prize_distribution_mode: "generated",
        prize_tier_id: null,
        prize_draw_template_id: null,
        prize_player_total: 0,
      }),
    );
  });

  it("does not carry tournament A values into a replacement tournament B", async () => {
    mockSearch.mockResolvedValue([
      {
        id: "known-b",
        name: "Replacement Open",
        location: "Paris",
        country: "France",
        currency: "USD",
        start_date: "2026-06-01",
        end_date: "2026-06-03",
      },
    ]);
    const { screen } = renderBuilder({
      ...validDraft,
      entry_fee: 300,
      prize_rounds: { ...defaultDraft.prize_rounds, qf: 500 },
      prize_tax_rate: 30,
    });

    fireEvent.press(screen.getByText("Change tournament"));
    fireEvent.changeText(screen.getByLabelText("Tournament name"), "Replacement");
    await advance(300);
    await waitFor(() => expect(screen.getByText("Replacement Open")).toBeTruthy());
    fireEvent.press(screen.getByText("Replacement Open"));
    fireEvent.press(screen.getByText("Continue"));
    await advance(350);
    await waitFor(() => expect(mockPreview).toHaveBeenCalled());

    expect(mockPreview.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        name: "Replacement Open",
        location: "Paris",
        country: "France",
        entry_fee: 0,
        prize_rounds: {},
        prize_tax_rate: 0,
      }),
    );
  });

  it("resynchronizes inline identity after editing the name in details", () => {
    const { screen } = renderBuilder(validDraft);

    fireEvent.press(screen.getByText("Tournament details"));
    const nameInputs = screen.getAllByLabelText("Tournament name");
    fireEvent.changeText(nameInputs[nameInputs.length - 1], "Renamed Open");
    fireEvent.press(screen.getByText("Apply tournament details"));

    expect(screen.getByText("Renamed Open")).toBeTruthy();
  });

  it("gates a valid expense-only draft on adding a prize estimate", () => {
    const { onSubmit, screen } = renderBuilder({
      ...validDraft,
      prize_rounds: { ...defaultDraft.prize_rounds },
    });

    fireEvent.press(screen.getByText("Add prize money"));
    expect(screen.getAllByText("Prize money").length).toBeGreaterThan(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows a non-USD projection without fabricated prize outcomes", () => {
    const onSubmit = jest.fn();
    const prizeRounds = { ...defaultDraft.prize_rounds };
    const { screen } = renderBuilder(
      {
        ...validDraft,
        currency: "EUR",
        prize_rounds: prizeRounds,
      },
      onSubmit,
    );

    fireEvent.press(screen.getByText("Create projection"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "EUR", prize_rounds: prizeRounds }),
    );
  });

  it("allows a USD event whose official payout schedule is unavailable", () => {
    const onSubmit = jest.fn();
    const { screen } = renderBuilder(validDraft, onSubmit);

    fireEvent.press(screen.getByText("Prize money"));
    fireEvent.press(screen.getByText("Tour Finals"));
    fireEvent.press(screen.getByText("Apply prize money"));

    expect(screen.getByText("Official payout schedule unavailable")).toBeTruthy();
    fireEvent.press(screen.getByText("Create projection"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        prize_tier_id: "world_tour_finals",
        prize_player_total: 0,
        prize_rounds: defaultDraft.prize_rounds,
      }),
    );
  });

  it("allows a known tournament with no supplied payout schedule", () => {
    const initialDraft = tournamentDraftFromKnown({
      name: "Known Open",
      location: "Detroit",
      country: "United States",
      currency: "USD",
    });
    const { onSubmit, screen } = renderBuilder(initialDraft);

    expect(screen.getByText("No prize outcomes supplied")).toBeTruthy();
    fireEvent.press(screen.getByText("Create projection"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Known Open",
        prize_distribution_mode: "manual",
        prize_rounds: defaultDraft.prize_rounds,
      }),
    );
  });

  it("keeps a saved USD event editable when it has no prize outcomes", () => {
    const onSubmit = jest.fn();
    const initialDraft = tournamentToDraft({
      ...savedTournament,
      prize_rounds: {},
    });
    const { screen } = renderBuilder(initialDraft, onSubmit);

    expect(screen.getByText("No prize outcomes saved")).toBeTruthy();
    fireEvent.press(screen.getByText("Save changes"));

    expect(onSubmit).toHaveBeenCalledWith(initialDraft);
  });

  it("edits one assumption and preserves untouched hydrated fields", () => {
    const onSubmit = jest.fn();
    const initialDraft = tournamentToDraft(savedTournament);
    const { screen } = renderBuilder(initialDraft, onSubmit);

    fireEvent.press(screen.getByText("Coaching / physio"));
    fireEvent.changeText(screen.getByLabelText("Coaching / physio (USD)"), "75");
    fireEvent.press(screen.getByText("Apply coaching / physio"));
    fireEvent.press(screen.getByText("Save changes"));

    expect(onSubmit).toHaveBeenCalledWith({ ...initialDraft, coaching_cost: 75 });
  });

  it("warns before leaving an edit with applied but unsaved changes", () => {
    const initialDraft = tournamentToDraft(savedTournament);
    const { screen } = renderBuilder(initialDraft, jest.fn());

    fireEvent.press(screen.getByText("Coaching / physio"));
    fireEvent.changeText(screen.getByLabelText("Coaching / physio (USD)"), "75");
    fireEvent.press(screen.getByText("Apply coaching / physio"));

    const preventRemove = mockUsePreventRemove.mock.calls.at(-1);
    expect(preventRemove?.[0]).toBe(true);
    preventRemove?.[1]({ data: { action: { type: "GO_BACK" } } });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Discard unsaved changes?",
      "Your tournament changes have not been saved.",
      expect.any(Array),
    );
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    act(() => {
      buttons?.[1]?.onPress?.();
    });
    expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
  });

  it("releases the navigation guard after an edit saves successfully", () => {
    const initialDraft = tournamentToDraft(savedTournament);
    const onSubmit = jest.fn();
    const { screen } = renderBuilder(initialDraft, onSubmit);

    fireEvent.press(screen.getByText("Coaching / physio"));
    fireEvent.changeText(screen.getByLabelText("Coaching / physio (USD)"), "75");
    fireEvent.press(screen.getByText("Apply coaching / physio"));

    expect(mockUsePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);

    screen.rerender(
      <TournamentDraftProvider userId="account-1">
        <TournamentProjectionBuilder
          authenticatedUserId="account-1"
          homeCurrency="USD"
          initialDraft={initialDraft}
          onSubmit={onSubmit}
          profileId="athlete-1"
          saveCompleted
          sport="tennis"
        />
      </TournamentDraftProvider>,
    );

    expect(mockUsePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("keeps navigation blocked while an edit save is pending", () => {
    const initialDraft = tournamentToDraft(savedTournament);
    const { screen } = renderBuilder(initialDraft, jest.fn());

    fireEvent.press(screen.getByText("Coaching / physio"));
    fireEvent.changeText(screen.getByLabelText("Coaching / physio (USD)"), "75");
    fireEvent.press(screen.getByText("Apply coaching / physio"));

    screen.rerender(
      <TournamentDraftProvider userId="account-1">
        <TournamentProjectionBuilder
          authenticatedUserId="account-1"
          homeCurrency="USD"
          initialDraft={initialDraft}
          loading
          onSubmit={jest.fn()}
          profileId="athlete-1"
          sport="tennis"
        />
      </TournamentDraftProvider>,
    );

    const preventRemove = mockUsePreventRemove.mock.calls.at(-1);
    expect(preventRemove?.[0]).toBe(true);
    preventRemove?.[1]({ data: { action: { type: "GO_BACK" } } });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Saving changes",
      "Wait for the tournament update to finish before leaving.",
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("save completion helpers", () => {
  it("dispatches create and update with normalized full-response writers", async () => {
    const writer = {
      create: jest.fn().mockResolvedValue(savedTournament),
      update: jest.fn().mockResolvedValue(savedTournament),
    };
    await saveTournamentDraft(validDraft, "athlete-1", writer);
    await saveTournamentDraft(
      { ...tournamentToDraft(savedTournament), coaching_cost: 75 },
      "athlete-1",
      writer,
    );

    expect(writer.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "athlete-1", name: "Open Championship" }),
    );
    expect(writer.update).toHaveBeenCalledWith(
      savedTournament.id,
      expect.objectContaining({ coaching_cost: 75 }),
    );
  });

  it("invalidates list/detail and resets immediately after confirmed save", () => {
    const completion = {
      invalidate: jest.fn(),
      resetDraft: jest.fn(),
    };
    completeTournamentSaveData("tournament-1", "athlete-1", completion);
    expect(completion.invalidate).toHaveBeenNthCalledWith(1, ["tournaments", "athlete-1"]);
    expect(completion.invalidate).toHaveBeenNthCalledWith(2, ["tournament", "tournament-1"]);
    expect(completion.resetDraft).toHaveBeenCalledTimes(1);
  });
});
