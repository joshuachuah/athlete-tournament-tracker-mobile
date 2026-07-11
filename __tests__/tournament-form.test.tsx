import { fireEvent, render } from "@testing-library/react-native";

import { TournamentForm } from "@/components/tournament/tournament-form";
import { TournamentDraftProvider } from "@/context/tournament-draft";
import {
  defaultTournamentDraft,
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

const validDraft = {
  ...defaultTournamentDraft,
  name: "Open Championship",
  location: "Detroit",
  country: "United States",
};

const editTournament: TournamentWithPnL = {
  id: "tournament-1",
  user_id: "athlete-1",
  name: "Open Championship",
  location: "Detroit",
  country: "United States",
  currency: "USD",
  start_date: "2026-04-01",
  end_date: "2026-04-03",
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
    total_income_base: 0,
    total_expenses: 0,
    scenarios: [],
    break_even_round: null,
  },
};

describe("TournamentForm", () => {
  it("expands the first invalid optional section and shows field errors", () => {
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm
          initialDraft={{ ...validDraft, prize_tax_rate: 101 }}
          onSubmit={jest.fn()}
        />
      </TournamentDraftProvider>,
    );

    expect(screen.queryByText("Prize tax withholding %")).toBeNull();

    fireEvent.press(screen.getByText("Create projection"));

    expect(screen.getByText("Prize tax withholding %")).toBeTruthy();
    expect(screen.getByText("Must be between 0 and 100.")).toBeTruthy();
    expect(screen.getByText("Review 1 highlighted field before saving.")).toBeTruthy();
  });

  it("submits a valid draft", () => {
    const onSubmit = jest.fn();
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm initialDraft={validDraft} onSubmit={onSubmit} />
      </TournamentDraftProvider>,
    );

    fireEvent.press(screen.getByText("Create projection"));

    expect(onSubmit).toHaveBeenCalledWith(validDraft);
  });

  it("edits only spending and preserves every untouched hydrated field", () => {
    const onSubmit = jest.fn();
    const initialDraft = tournamentToDraft(editTournament);
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm initialDraft={initialDraft} onSubmit={onSubmit} />
      </TournamentDraftProvider>,
    );

    fireEvent.press(screen.getByText("Spending"));
    fireEvent.changeText(screen.getByDisplayValue("50"), "75");
    fireEvent.press(screen.getByText("Save changes"));

    expect(onSubmit).toHaveBeenCalledWith({
      ...initialDraft,
      coaching_cost: 75,
    });
  });

  it("summarizes entered amounts while optional sections stay collapsed", () => {
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm
          initialDraft={tournamentToDraft(editTournament)}
          onSubmit={jest.fn()}
        />
      </TournamentDraftProvider>,
    );

    expect(screen.getByText("$500 USD planned")).toBeTruthy();
    expect(screen.getByText("$75 USD extras · $80 USD daily cap")).toBeTruthy();
    expect(screen.queryByText("Flights (USD)")).toBeNull();
  });
});

describe("saveTournamentDraft", () => {
  it("calls create with the normalized payload for a new tournament", async () => {
    const writer = {
      create: jest.fn().mockResolvedValue({ id: "new-tournament" }),
      update: jest.fn(),
    };

    await expect(
      saveTournamentDraft(validDraft, "athlete-1", writer),
    ).resolves.toEqual({ id: "new-tournament" });

    expect(writer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "athlete-1",
        name: "Open Championship",
      }),
    );
    expect(writer.update).not.toHaveBeenCalled();
  });

  it("calls update with the edit id and preserves untouched fields", async () => {
    const writer = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: "tournament-1" }),
    };
    const editDraft = {
      ...validDraft,
      editId: "tournament-1",
      entry_fee: 100,
      flight_cost: 200,
      accommodation_total: 300,
      coaching_cost: 75,
    };

    await saveTournamentDraft(editDraft, "athlete-1", writer);

    expect(writer.update).toHaveBeenCalledWith(
      "tournament-1",
      expect.objectContaining({
        entry_fee: 100,
        flight_cost: 200,
        accommodation_total: 300,
        coaching_cost: 75,
      }),
    );
    expect(writer.create).not.toHaveBeenCalled();
  });
});
