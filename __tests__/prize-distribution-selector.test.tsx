import { act, fireEvent, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Alert, ScrollView } from "react-native";

import { PrizeDistributionSelector } from "@/components/tournament/prize-distribution-selector";
import { ProjectionEditorFields } from "@/components/tournament/projection-editor-fields";
import { ProjectionEditorSheet } from "@/components/tournament/projection-editor-sheet";
import {
  createDefaultTournamentDraft,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import type { PnLResult } from "@/types";

function PrizeEditorHarness({
  initialDraft,
  prizePreview,
}: {
  initialDraft: TournamentDraft;
  prizePreview?: PnLResult;
}) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <ProjectionEditorFields
      editor="prize"
      errors={{}}
      prizePreview={prizePreview}
      workingDraft={draft}
      onUpdate={(changes) =>
        setDraft((current) => ({ ...current, ...changes }))
      }
      onUpdateAccommodation={() => undefined}
    />
  );
}

function renderPrizeEditor(
  overrides: Partial<TournamentDraft> = {},
  prizePreview?: PnLResult,
) {
  const draft = { ...createDefaultTournamentDraft(), ...overrides };
  return render(
    <PrizeEditorHarness initialDraft={draft} prizePreview={prizePreview} />,
  );
}

function renderWithClient(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
}

const alertSpy = jest.spyOn(Alert, "alert");

function confirmTerritoryDraw() {
  const latestCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const confirmButton = latestCall?.[2]?.find(
    (button) => button.text === "Confirm territory event",
  );

  act(() => confirmButton?.onPress?.());
}

describe("PrizeDistributionSelector", () => {
  beforeEach(() => {
    alertSpy.mockReset();
    alertSpy.mockImplementation(() => undefined);
  });

  afterAll(() => alertSpy.mockRestore());

  it("fills the implied Bronze draw payouts as soon as the tier is tapped", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("Draw set by tier")).toBeTruthy();
    expect(screen.getByText("Confirm bye adjustments")).toBeTruthy();
    expect(screen.getByLabelText("R1 payout, $997.5 USD gross")).toBeTruthy();
    expect(screen.getByLabelText("Win payout, $10,830 USD gross")).toBeTruthy();
    expect(screen.queryByText("R3")).toBeNull();
  });

  it("renders generated payout rows without editable inputs", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByLabelText("QF payout, $2,565 USD gross")).toBeTruthy();
    expect(screen.queryByLabelText("QF (USD)")).toBeNull();
    expect(screen.queryByLabelText("Edit QF payout")).toBeNull();
    expect(screen.queryByText("Enter payouts manually")).toBeNull();
  });

  it("regenerates read-only payouts when the selected tier changes", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByText("Gold"));

    expect(screen.queryByLabelText("QF (USD)")).toBeNull();
    expect(screen.getByLabelText("QF payout, $5,130 USD gross")).toBeTruthy();
  });

  it("fills Challenger payouts from the published player prize once a draw is chosen", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("6K"));
    fireEvent.press(screen.getByText("Hotel"));

    // No draw chosen yet: payouts cannot be generated.
    expect(screen.getAllByText("$5,000 USD").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Choose a supported PSA tier and draw to generate the payout schedule.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("16 draw · 16 entries"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Territory-based events only",
      "The 16-player draw applies only to territory-based Challenger 3 and Challenger 6 events.",
      expect.any(Array),
    );
    expect(screen.queryByLabelText("R1 payout, $195 USD gross")).toBeNull();

    confirmTerritoryDraw();

    expect(screen.getByLabelText("R1 payout, $195 USD gross")).toBeTruthy();
    expect(screen.getByLabelText("Win payout, $1,200 USD gross")).toBeTruthy();
  });

  it("keeps a Challenger draw chosen before the level", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("16 draw · 16 entries"));
    confirmTerritoryDraw();
    fireEvent.press(screen.getByText("6K"));

    expect(
      screen.getByRole("radio", {
        name: "16 draw · 16 entries",
        checked: true,
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText("R1 payout, $195 USD gross")).toBeTruthy();
    expect(screen.getByLabelText("Win payout, $1,200 USD gross")).toBeTruthy();
  });

  it("clears an incompatible World tier when a Challenger draw is chosen", () => {
    const onUpdate = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 57_000,
      prize_rounds: {
        ...createDefaultTournamentDraft().prize_rounds,
        r1: 997.5,
        r2: 1_567.5,
        r3: 0,
        qf: 2_565,
        sf: 4_275,
        f: 6_840,
        w: 10_830,
      },
    };
    const screen = render(
      <PrizeDistributionSelector draft={draft} onUpdate={onUpdate} />,
    );

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("16 draw · 16 entries"));
    expect(onUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        prize_draw_template_id: "draw_16_entries_16",
      }),
    );
    confirmTerritoryDraw();

    expect(onUpdate).toHaveBeenCalledWith({
      prize_distribution_mode: "generated",
      prize_tier_id: null,
      prize_player_total: 0,
      prize_draw_template_id: "draw_16_entries_16",
      prize_rounds: createDefaultTournamentDraft().prize_rounds,
    });
  });

  it("only offers accommodation options the level actually has", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("3K"));

    expect(
      screen.getByRole("radio", { name: "Hotel" }),
    ).toBeDisabled();
  });

  it.each([9, 12, 15, 18])(
    "does not offer the territory-only draw for Challenger %s",
    (level) => {
      const screen = renderPrizeEditor();

      fireEvent.press(screen.getByText("Challenger"));
      fireEvent.press(screen.getByText(`${level}K`));

      expect(screen.queryByText("16 draw · 16 entries")).toBeNull();
      expect(
        screen.getByRole("radio", { name: /32 draw · 24 entries/ }),
      ).toBeTruthy();
    },
  );

  it("preserves a saved payout snapshot until a PSA selection changes", () => {
    const defaultDraft = createDefaultTournamentDraft();
    const screen = renderPrizeEditor({
      prize_distribution_mode: "manual",
      prize_rounds: { ...defaultDraft.prize_rounds, qf: 500 },
    });

    expect(screen.getByText("Saved payout schedule")).toBeTruthy();
    expect(screen.getByLabelText("QF payout, $500 USD gross")).toBeTruthy();
    expect(screen.queryByLabelText("QF (USD)")).toBeNull();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("PSA generated")).toBeTruthy();
    expect(screen.getByLabelText("QF payout, $2,565 USD gross")).toBeTruthy();
    expect(screen.queryByLabelText("QF payout, $500 USD gross")).toBeNull();
  });

  it("shows every positive round in a manual snapshot with selector metadata", () => {
    const defaultDraft = createDefaultTournamentDraft();
    const screen = renderPrizeEditor({
      prize_distribution_mode: "manual",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_rounds: { ...defaultDraft.prize_rounds, r3: 700, qf: 500 },
    });

    expect(screen.getByText("Saved payout schedule")).toBeTruthy();
    expect(screen.getByText("R3")).toBeTruthy();
    expect(screen.getByLabelText("R3 payout, $700 USD gross")).toBeTruthy();
    expect(screen.getByLabelText("QF payout, $500 USD gross")).toBeTruthy();
    expect(screen.queryByText("4 players paid")).toBeNull();
  });

  it("limits a generated schedule to rounds in its selected template", () => {
    const defaultDraft = createDefaultTournamentDraft();
    const screen = renderPrizeEditor({
      prize_distribution_mode: "generated",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 57_000,
      prize_rounds: { ...defaultDraft.prize_rounds, r3: 700, qf: 500 },
    });

    expect(screen.getByText("PSA generated")).toBeTruthy();
    expect(screen.queryByText("R3")).toBeNull();
    expect(screen.queryByText("$700 USD")).toBeNull();
    expect(screen.getByLabelText("QF payout, $500 USD gross")).toBeTruthy();
    expect(screen.getByText("4 players paid")).toBeTruthy();
  });

  it("blocks official generation when the tournament currency is not USD", () => {
    const screen = renderPrizeEditor({ currency: "EUR" });

    expect(screen.getByRole("radio", { name: /Bronze/ })).toBeDisabled();
    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("USD required for official tiers")).toBeTruthy();
    expect(
      screen.getByText(
        "Official USD payout outcomes are unavailable for this tournament currency.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("€47,500 EUR")).toBeNull();
    expect(screen.queryByText("$831.25 USD")).toBeNull();
  });

  it("does not store selector provenance for a non-USD tournament", () => {
    const onUpdate = jest.fn();
    const screen = render(
      <PrizeDistributionSelector
        draft={{ ...createDefaultTournamentDraft(), currency: "EUR" }}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.press(screen.getByText("Bronze"));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it.each(["generated", "manual"] as const)(
    "clears selector payouts when the tournament currency changes in %s mode",
    async (prizeDistributionMode) => {
      const onApply = jest.fn();
      const draft: TournamentDraft = {
        ...createDefaultTournamentDraft(),
        name: "Malaysia Open",
        location: "Kuala Lumpur",
        country: "Malaysia",
        country_code: "MY",
        prize_distribution_mode: prizeDistributionMode,
        prize_tier_id: "world_bronze",
        prize_draw_template_id: "draw_32_entries_24",
        prize_player_total: 57_000,
        prize_rounds: {
          ...createDefaultTournamentDraft().prize_rounds,
          r1: 997.5,
          r2: 1_567.5,
          r3: 0,
          qf: 2_565,
          sf: 4_275,
          f: 6_840,
          w: 10_830,
        },
      };
      const screen = renderWithClient(
        <ProjectionEditorSheet
          editor="details"
          draft={draft}
          onApply={onApply}
          onClose={() => undefined}
        />,
      );

      await act(async () => {
        fireEvent.changeText(screen.getByLabelText("Currency"), "EUR");
      });
      await act(async () => {
        fireEvent.press(screen.getByText("Apply tournament details"));
      });

      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "EUR",
          prize_distribution_mode: "generated",
          prize_tier_id: null,
          prize_draw_template_id: null,
          prize_player_total: 0,
          prize_rounds: createDefaultTournamentDraft().prize_rounds,
        }),
      );
    },
  );

  it("preserves selector payouts when the final currency is unchanged", async () => {
    const onApply = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      name: "Malaysia Open",
      location: "Kuala Lumpur",
      country: "Malaysia",
      country_code: "MY",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 57_000,
      prize_rounds: {
        ...createDefaultTournamentDraft().prize_rounds,
        r1: 997.5,
        r2: 1_567.5,
        r3: 0,
        qf: 2_565,
        sf: 4_275,
        f: 6_840,
        w: 10_830,
      },
    };
    const screen = renderWithClient(
      <ProjectionEditorSheet
        editor="details"
        draft={draft}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Currency"), "US");
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Currency"), "USD");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Apply tournament details"));
    });

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "USD",
        prize_tier_id: "world_bronze",
        prize_draw_template_id: "draw_32_entries_24",
        prize_player_total: 57_000,
        prize_rounds: draft.prize_rounds,
      }),
    );
  });

  it("clears saved payouts without selector provenance when currency changes", async () => {
    const onApply = jest.fn();
    const defaultDraft = createDefaultTournamentDraft();
    const draft: TournamentDraft = {
      ...defaultDraft,
      name: "Malaysia Open",
      location: "Kuala Lumpur",
      country: "Malaysia",
      country_code: "MY",
      prize_rounds: {
        ...defaultDraft.prize_rounds,
        qf: 500,
      },
    };
    const screen = renderWithClient(
      <ProjectionEditorSheet
        editor="details"
        draft={draft}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Currency"), "EUR");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Apply tournament details"));
    });

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "EUR",
        prize_distribution_mode: "generated",
        prize_rounds: defaultDraft.prize_rounds,
      }),
    );
  });

  it("generates the Tour Finals placement schedule", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Tour Finals"));

    expect(
      screen.getByRole("radio", { name: /Tour Finals/, checked: true }),
    ).toBeTruthy();
    expect(screen.getByText("7th–8th")).toBeTruthy();
    expect(
      screen.getByLabelText("7th–8th payout, $16,625 USD gross"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Win payout, $99,750 USD gross")).toBeTruthy();
  });

  it("shows gross prize messaging without manual withholding controls", () => {
    const screen = renderPrizeEditor();

    expect(screen.getByText("Gross prize only")).toBeTruthy();
    expect(
      screen.getByText(
        "No estimated withholding rate is known for this tournament.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("15%")).toBeNull();
    expect(screen.queryByText("Custom")).toBeNull();
    expect(screen.queryByLabelText(/Estimated withholding/)).toBeNull();
  });

  it("renders a supplied withholding rate as read-only tournament data", () => {
    const screen = renderPrizeEditor({
      country: "United States",
      country_code: "US",
      prize_tax_rate: 30,
    });

    expect(screen.getByText("Estimated withholding included")).toBeTruthy();
    expect(
      screen.getByText(
        "This projection uses a 30% estimated withholding rate.",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/Estimated withholding/)).toBeNull();
  });

  it("renders the server-provided after-withholding payout beside gross", () => {
    const draft = createDefaultTournamentDraft();
    const screen = renderPrizeEditor(
      {
        country: "United States",
        country_code: "US",
        prize_tax_rate: 30,
        prize_distribution_mode: "generated",
        prize_tier_id: "world_gold",
        prize_draw_template_id: "draw_32_entries_24",
        prize_player_total: 114_000,
        prize_rounds: { ...draft.prize_rounds, w: 21_660 },
      },
      {
        total_expenses: 0,
        total_income_base: 0,
        scenarios: [],
        break_even_round: "w",
        estimated_withholding_rate: 30,
        prize_rounds_after_estimated_withholding: { w: 15_162 },
      },
    );

    expect(
      screen.getByLabelText(
        "Win payout, $21,660 USD gross, $15,162 USD after estimated withholding",
      ),
    ).toBeTruthy();
  });
});

describe("ProjectionEditorSheet", () => {
  it("dismisses the keyboard on drag without interactive frame tracking", () => {
    const screen = renderWithClient(
      <ProjectionEditorSheet
        editor="prize"
        draft={createDefaultTournamentDraft()}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardDismissMode).toBe(
      "on-drag",
    );
  });
});
