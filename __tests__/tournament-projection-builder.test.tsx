import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren, ReactElement } from "react";

import { TournamentProjectionBuilder } from "@/components/tournament/tournament-projection-builder";
import { TournamentDraftProvider } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import {
  completeTournamentSaveData,
  createDefaultTournamentDraft,
  saveTournamentDraft,
  tournamentToDraft,
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
});

afterEach(() => {
  jest.useRealTimers();
});

describe("TournamentProjectionBuilder", () => {
  it("keeps the inline action clear of the iOS native tab bar", () => {
    const { screen } = renderBuilder(validDraft);

    expect(screen.getByTestId("projection-builder-scroll").props.contentContainerStyle.paddingBottom).toBe(64);
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
    fireEvent.press(screen.getByText("Add prize estimate"));
    fireEvent.changeText(screen.getByLabelText("QF (USD)"), "250");
    fireEvent.press(screen.getByText("Apply prize and tax"));
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

    expect(screen.getByText("Review prize and tax")).toBeTruthy();
    fireEvent.press(screen.getByText("Review prize and tax"));
    fireEvent.press(screen.getByText("Apply prize and tax"));

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

    fireEvent.press(screen.getByText("Add prize estimate"));
    expect(screen.getAllByText("Prize and tax").length).toBeGreaterThan(1);
    expect(onSubmit).not.toHaveBeenCalled();
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
