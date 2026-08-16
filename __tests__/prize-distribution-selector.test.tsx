import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

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

  it("turns a payout row into an editable input on tap", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByLabelText("Edit QF payout"));

    const input = screen.getByLabelText("QF (USD)");
    expect(input.props.value).toBe("2137.5");

    fireEvent.changeText(input, "2200");
    fireEvent(input, "blur");

    expect(screen.getByText("$2,200 USD")).toBeTruthy();
  });

  it("ends an active round edit when a tier regenerates payouts", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByLabelText("Edit QF payout"));
    fireEvent.changeText(screen.getByLabelText("QF (USD)"), "2200");
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
    expect(screen.getByText("$5,000 USD")).toBeTruthy();
    expect(screen.queryByLabelText("Edit R1 payout")).toBeNull();

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

  it("switches to all-round manual entry without clearing generated amounts", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("Bronze"));
    fireEvent.press(screen.getByLabelText("Edit QF payout"));
    fireEvent.changeText(screen.getByLabelText("QF (USD)"), "2200");
    fireEvent.press(screen.getByText("Enter payouts manually"));

    expect(screen.getByLabelText("QF (USD)").props.value).toBe("2200");
    expect(screen.getByLabelText("R3 (USD)")).toBeTruthy();
    expect(screen.getByText("Use PSA selector")).toBeTruthy();
  });

  it("clears rounds outside the template when returning to generated mode", () => {
    const onUpdate = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      prize_distribution_mode: "manual",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 47_500,
      prize_rounds: {
        r1: 800,
        r2: 1_300,
        r3: 500,
        qf: 2_100,
        sf: 3_500,
        f: 5_700,
        w: 9_000,
      },
    };
    const screen = render(
      <PrizeDistributionSelector draft={draft} onUpdate={onUpdate} />,
    );

    fireEvent.press(screen.getByText("Use PSA selector"));

    expect(onUpdate).toHaveBeenCalledWith({
      prize_distribution_mode: "generated",
      prize_rounds: {
        r1: 800,
        r2: 1_300,
        r3: 0,
        qf: 2_100,
        sf: 3_500,
        f: 5_700,
        w: 9_000,
      },
    });
  });

  it("blocks official generation when the tournament currency is not USD", () => {
    const screen = renderPrizeEditor({ currency: "EUR" });

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("USD required for official tiers")).toBeTruthy();
    expect(screen.getAllByText("€0 EUR").length).toBeGreaterThan(0);
    expect(screen.queryByText("$831.25 USD")).toBeNull();
  });

  it("drops unused selector metadata when blocked payouts switch to manual", () => {
    const onUpdate = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      currency: "EUR",
      prize_tier_id: "world_bronze",
      prize_draw_template_id: "draw_32_entries_24",
      prize_player_total: 47_500,
    };
    const screen = render(
      <PrizeDistributionSelector draft={draft} onUpdate={onUpdate} />,
    );

    fireEvent.press(screen.getByText("Enter payouts manually"));

    expect(onUpdate).toHaveBeenCalledWith({
      prize_distribution_mode: "manual",
      prize_tier_id: null,
      prize_draw_template_id: null,
      prize_player_total: 0,
    });
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

  it("shows Tour Finals as manual-only", () => {
    const screen = renderPrizeEditor();

    expect(screen.getByText("Tour Finals")).toBeTruthy();
    expect(screen.getByText("Manual only · group format")).toBeTruthy();
  });

  it("records the withholding rate through presets and custom entry", () => {
    const screen = renderPrizeEditor();

    fireEvent.press(screen.getByText("15%"));
    fireEvent.press(screen.getByText("Custom"));

    const customInput = screen.getByLabelText("Prize tax withholding %");
    expect(customInput.props.value).toBe("15");

    fireEvent.changeText(customInput, "12.5");
    expect(screen.getByLabelText("Prize tax withholding %").props.value).toBe(
      "12.5",
    );
  });
});
