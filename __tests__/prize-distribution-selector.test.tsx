import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { ScrollView } from "react-native";

import { PrizeDistributionSelector } from "@/components/tournament/prize-distribution-selector";
import { ProjectionEditorFields } from "@/components/tournament/projection-editor-fields";
import { ProjectionEditorSheet } from "@/components/tournament/projection-editor-sheet";
import {
  createDefaultTournamentDraft,
  type TournamentDraft,
} from "@/lib/tournament-draft";

function PrizeEditorHarness({ initialDraft }: { initialDraft: TournamentDraft }) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <ProjectionEditorFields
      editor="prize"
      errors={{}}
      workingDraft={draft}
      onUpdate={(changes) =>
        setDraft((current) => ({ ...current, ...changes }))
      }
      onUpdateAccommodation={() => undefined}
    />
  );
}

function renderPrizeEditor(overrides: Partial<TournamentDraft> = {}) {
  const draft = { ...createDefaultTournamentDraft(), ...overrides };
  return render(<PrizeEditorHarness initialDraft={draft} />);
}

describe("PrizeDistributionSelector", () => {
  it("fills the implied Bronze draw payouts as soon as the tier is tapped", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("Draw set by tier")).toBeTruthy();
    expect(screen.getByText("Confirm bye adjustments")).toBeTruthy();
    expect(screen.getByText("$831.25 USD")).toBeTruthy();
    expect(screen.getByText("$9,025 USD")).toBeTruthy();
    expect(screen.queryByText("R3")).toBeNull();
  });

  it("renders generated payout rows without editable inputs", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("$2,137.5 USD")).toBeTruthy();
    expect(screen.queryByLabelText("QF (USD)")).toBeNull();
    expect(screen.queryByLabelText("Edit QF payout")).toBeNull();
    expect(screen.queryByText("Enter payouts manually")).toBeNull();
  });

  it("regenerates read-only payouts when the selected tier changes", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByText("Gold"));

    expect(screen.queryByLabelText("QF (USD)")).toBeNull();
    expect(screen.getByText("$4,275 USD")).toBeTruthy();
  });

  it("fills Challenger payouts from the accommodation-adjusted base once a draw is chosen", () => {
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

    expect(screen.getByText("$162.5 USD")).toBeTruthy();
    expect(screen.getByText("$1,000 USD")).toBeTruthy();
  });

  it("keeps a Challenger draw chosen before the level", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("16 draw · 16 entries"));
    fireEvent.press(screen.getByText("6K"));

    expect(
      screen.getByRole("radio", {
        name: "16 draw · 16 entries",
        checked: true,
      }),
    ).toBeTruthy();
    expect(screen.getByText("$195 USD")).toBeTruthy();
    expect(screen.getByText("$1,200 USD")).toBeTruthy();
  });

  it("clears an incompatible World tier when a Challenger draw is chosen", () => {
    const onUpdate = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 47_500,
      prize_rounds: {
        r1: 831.25,
        r2: 1_306.25,
        r3: 0,
        qf: 2_137.5,
        sf: 3_562.5,
        f: 5_700,
        w: 9_025,
      },
    };
    const screen = render(
      <PrizeDistributionSelector draft={draft} onUpdate={onUpdate} />,
    );

    fireEvent.press(screen.getByText("Challenger"));
    fireEvent.press(screen.getByText("16 draw · 16 entries"));

    expect(onUpdate).toHaveBeenCalledWith({
      prize_distribution_mode: "generated",
      prize_tier_id: null,
      prize_player_total: 0,
      prize_draw_template_id: "draw_16_entries_16",
      prize_rounds: { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 },
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

  it("preserves a saved payout snapshot until a PSA selection changes", () => {
    const defaultDraft = createDefaultTournamentDraft();
    const screen = renderPrizeEditor({
      prize_distribution_mode: "manual",
      prize_rounds: { ...defaultDraft.prize_rounds, qf: 500 },
    });

    expect(screen.getByText("Saved payout schedule")).toBeTruthy();
    expect(screen.getByText("$500 USD")).toBeTruthy();
    expect(screen.queryByLabelText("QF (USD)")).toBeNull();

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("PSA generated")).toBeTruthy();
    expect(screen.getByText("$2,137.5 USD")).toBeTruthy();
    expect(screen.queryByText("$500 USD")).toBeNull();
  });

  it("blocks official generation when the tournament currency is not USD", () => {
    const screen = renderPrizeEditor({ currency: "EUR" });

    expect(screen.getByRole("radio", { name: /Bronze/ })).toBeDisabled();
    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("USD required for official tiers")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose a supported PSA tier and draw to generate the payout schedule.",
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
        prize_distribution_mode: prizeDistributionMode,
        prize_tier_id: "world_bronze",
        prize_draw_template_id: "draw_32_entries_24",
        prize_player_total: 47_500,
        prize_rounds: {
          r1: 831.25,
          r2: 1_306.25,
          r3: 0,
          qf: 2_137.5,
          sf: 3_562.5,
          f: 5_700,
          w: 9_025,
        },
      };
      const screen = render(
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
          prize_tier_id: null,
          prize_draw_template_id: null,
          prize_player_total: 0,
          prize_rounds: { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 },
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
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 47_500,
      prize_rounds: {
        r1: 831.25,
        r2: 1_306.25,
        r3: 0,
        qf: 2_137.5,
        sf: 3_562.5,
        f: 5_700,
        w: 9_025,
      },
    };
    const screen = render(
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
        prize_player_total: 47_500,
        prize_rounds: draft.prize_rounds,
      }),
    );
  });

  it("preserves typed payouts without selector provenance when currency changes", async () => {
    const onApply = jest.fn();
    const defaultDraft = createDefaultTournamentDraft();
    const draft: TournamentDraft = {
      ...defaultDraft,
      name: "Malaysia Open",
      location: "Kuala Lumpur",
      country: "Malaysia",
      prize_rounds: {
        ...defaultDraft.prize_rounds,
        qf: 500,
      },
    };
    const screen = render(
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
        prize_rounds: draft.prize_rounds,
      }),
    );
  });

  it("keeps unsupported Tour Finals unavailable", () => {
    const screen = renderPrizeEditor();

    expect(screen.getByText("Tour Finals")).toBeTruthy();
    expect(screen.getByText("Payout schedule unavailable")).toBeTruthy();
  });

  it("shows gross prize messaging without manual withholding controls", () => {
    const screen = renderPrizeEditor();

    expect(screen.getByText("Gross prize projection")).toBeTruthy();
    expect(
      screen.getByText(
        "Withholding is not included because no verified rate is available.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("15%")).toBeNull();
    expect(screen.queryByText("Custom")).toBeNull();
    expect(screen.queryByLabelText("Prize tax withholding %")).toBeNull();
  });

  it("renders a supplied withholding rate as read-only tournament data", () => {
    const screen = renderPrizeEditor({ prize_tax_rate: 30 });

    expect(screen.getByText("Withholding included")).toBeTruthy();
    expect(
      screen.getByText(
        "The server will apply the 30% rate supplied with this tournament.",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Prize tax withholding %")).toBeNull();
  });
});

describe("ProjectionEditorSheet", () => {
  it("dismisses the keyboard on drag without interactive frame tracking", () => {
    const screen = render(
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
