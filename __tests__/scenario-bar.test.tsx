import { render } from "@testing-library/react-native";

import { ScenarioBar } from "@/components/dashboard/scenario-bar";
import { colors } from "@/constants/theme";
import type { ScenarioResult, TournamentWithPnL } from "@/types";

function tournament(scenarios: ScenarioResult[]): TournamentWithPnL {
  return {
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
    daily_spending_cap: 75,
    coaching_cost: 0,
    misc_cost: 0,
    subsidy_by: null,
    subsidy_amount: 0,
    subsidy_covers: null,
    sponsorship_allocated: 0,
    prize_rounds: {},
    prize_tax_rate: 0,
    created_at: "2026-01-01",
    home_currency: "USD",
    pnl: {
      total_income_base: 0,
      total_expenses: 600,
      break_even_round: null,
      scenarios,
    },
  };
}

const breakEvenScenario: ScenarioResult = {
  scenario: "realistic",
  round: "qf",
  prize_money: 600,
  prize_money_after_tax: 600,
  net_result: 0,
  profitable: true,
};

describe("ScenarioBar", () => {
  it("uses neutral segments when every projection is unavailable", () => {
    const screen = render(<ScenarioBar tournament={tournament([])} />);

    expect(screen.getByTestId("scenario-segment-worst").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.surfaceMuted }),
    );
    expect(screen.getByTestId("scenario-segment-realistic").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.surfaceMuted }),
    );
    expect(screen.getByTestId("scenario-segment-best").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.surfaceMuted }),
    );
  });

  it("uses neutral styling only for an unavailable segment", () => {
    const screen = render(
      <ScenarioBar tournament={tournament([breakEvenScenario])} />,
    );

    expect(screen.getByTestId("scenario-segment-worst").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.surfaceMuted }),
    );
    expect(screen.getByTestId("scenario-segment-realistic").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.profit }),
    );
    expect(screen.getByTestId("scenario-segment-best").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.surfaceMuted }),
    );
  });

  it("keeps a real numeric zero as a non-loss projection", () => {
    const screen = render(
      <ScenarioBar tournament={tournament([breakEvenScenario])} />,
    );

    expect(screen.getByTestId("scenario-segment-realistic").props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.profit }),
    );
  });
});
