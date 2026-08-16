import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import { ProjectionEditorFields } from "@/components/tournament/projection-editor-fields";
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

  it("blocks official generation when the tournament currency is not USD", () => {
    const screen = renderPrizeEditor({ currency: "EUR" });

    fireEvent.press(screen.getByText("Bronze"));

    expect(screen.getByText("USD required for official tiers")).toBeTruthy();
    expect(screen.getAllByText("€0 EUR").length).toBeGreaterThan(0);
    expect(screen.queryByText("$831.25 USD")).toBeNull();
  });

  it("clears generated payouts when the tournament currency changes", () => {
    const onUpdate = jest.fn();
    const draft: TournamentDraft = {
      ...createDefaultTournamentDraft(),
      prize_distribution_mode: "generated",
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
      <ProjectionEditorFields
        editor="details"
        errors={{}}
        workingDraft={draft}
        onUpdate={onUpdate}
        onUpdateAccommodation={() => undefined}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Currency"), "EUR");

    expect(onUpdate).toHaveBeenCalledWith({
      currency: "EUR",
      prize_tier_id: null,
      prize_draw_template_id: null,
      prize_player_total: 0,
      prize_rounds: { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 },
    });
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
