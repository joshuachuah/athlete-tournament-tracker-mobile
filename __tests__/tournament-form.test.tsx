import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { TournamentForm } from "@/components/tournament/tournament-form";
import {
  TournamentDraftProvider,
  useTournamentDraft,
} from "@/context/tournament-draft";
import {
  completeTournamentSave,
  createDefaultTournamentDraft,
  saveTournamentDraft,
  tournamentToDraft,
} from "@/lib/tournament-draft";
import { tournamentDraftStorageKey } from "@/lib/storage";
import type { TournamentWithPnL } from "@/types";

const defaultTournamentDraft = createDefaultTournamentDraft(
  new Date(2026, 0, 1),
);

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

function DraftNameProbe() {
  const { draft } = useTournamentDraft();

  return <Text testID="draft-name">{draft.name}</Text>;
}

describe("TournamentForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists a keyed prefill to draft context on mount", () => {
    const prefillDraft = {
      ...validDraft,
      name: "Prefilled Invitational",
      location: "Kuala Lumpur",
      country: "Malaysia",
    };
    const screen = render(
      <TournamentDraftProvider userId="athlete-prefill">
        <TournamentForm
          key="prefill:known-tournament"
          initialDraft={prefillDraft}
          onSubmit={jest.fn()}
        />
        <DraftNameProbe />
      </TournamentDraftProvider>,
    );

    expect(screen.getByDisplayValue("Prefilled Invitational")).toBeTruthy();
    expect(screen.getByTestId("draft-name").props.children).toBe(
      "Prefilled Invitational",
    );
    expect(
      JSON.parse(
        localStorage.getItem(
          tournamentDraftStorageKey("athlete-prefill"),
        ) ?? "null",
      ),
    ).toEqual(
      expect.objectContaining({
        version: 1,
        draft: expect.objectContaining({ name: "Prefilled Invitational" }),
      }),
    );
  });

  it("replaces corrupt persisted drafts with a versioned fresh draft", () => {
    const key = tournamentDraftStorageKey("athlete-corrupt");
    localStorage.setItem(key, JSON.stringify({ name: null }));

    const screen = render(
      <TournamentDraftProvider userId="athlete-corrupt">
        <DraftNameProbe />
      </TournamentDraftProvider>,
    );

    expect(screen.getByTestId("draft-name").props.children).toBe("");
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(
      expect.objectContaining({
        version: 1,
        draft: expect.objectContaining({ name: "" }),
      }),
    );
  });

  it("replaces malformed persisted draft JSON with a versioned fresh draft", () => {
    const key = tournamentDraftStorageKey("athlete-malformed");
    localStorage.setItem(key, "{");

    const screen = render(
      <TournamentDraftProvider userId="athlete-malformed">
        <DraftNameProbe />
      </TournamentDraftProvider>,
    );

    expect(screen.getByTestId("draft-name").props.children).toBe("");
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(
      expect.objectContaining({
        version: 1,
        draft: expect.objectContaining({ name: "" }),
      }),
    );
  });

  it("remounts a different keyed edit without submitting stale values", () => {
    const firstDraft = tournamentToDraft(editTournament);
    const secondDraft = tournamentToDraft({
      ...editTournament,
      id: "tournament-2",
      name: "Second Championship",
      location: "Singapore",
      country: "Singapore",
    });
    const firstSubmit = jest.fn();
    const secondSubmit = jest.fn();
    const screen = render(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm
          key="edit:tournament-1"
          initialDraft={firstDraft}
          onSubmit={firstSubmit}
        />
      </TournamentDraftProvider>,
    );

    screen.rerender(
      <TournamentDraftProvider userId="athlete-1">
        <TournamentForm
          key="edit:tournament-2"
          initialDraft={secondDraft}
          onSubmit={secondSubmit}
        />
      </TournamentDraftProvider>,
    );
    fireEvent.press(screen.getByText("Save changes"));

    expect(screen.queryByDisplayValue("Open Championship")).toBeNull();
    expect(screen.getByDisplayValue("Second Championship")).toBeTruthy();
    expect(firstSubmit).not.toHaveBeenCalled();
    expect(secondSubmit).toHaveBeenCalledWith(secondDraft);
  });

  it("keeps field edits synchronized with draft context", () => {
    const screen = render(
      <TournamentDraftProvider userId="athlete-sync">
        <TournamentForm initialDraft={validDraft} onSubmit={jest.fn()} />
        <DraftNameProbe />
      </TournamentDraftProvider>,
    );

    fireEvent.changeText(
      screen.getByDisplayValue("Open Championship"),
      "Updated Championship",
    );

    expect(screen.getByDisplayValue("Updated Championship")).toBeTruthy();
    expect(screen.getByTestId("draft-name").props.children).toBe(
      "Updated Championship",
    );
  });

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

  it("invalidates list/detail data, resets the draft, and redirects after save", () => {
    const completion = {
      invalidate: jest.fn(),
      resetDraft: jest.fn(),
      replace: jest.fn(),
    };

    completeTournamentSave("tournament-1", "athlete-1", completion);

    expect(completion.invalidate).toHaveBeenNthCalledWith(1, [
      "tournaments",
      "athlete-1",
    ]);
    expect(completion.invalidate).toHaveBeenNthCalledWith(2, [
      "tournament",
      "tournament-1",
    ]);
    expect(completion.resetDraft).toHaveBeenCalledTimes(1);
    expect(completion.replace).toHaveBeenCalledWith(
      "/tournaments/tournament-1",
    );
  });
});
