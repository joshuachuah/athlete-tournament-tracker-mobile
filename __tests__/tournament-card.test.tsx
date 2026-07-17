import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { TournamentCard } from "@/components/dashboard/tournament-card";
import { colors } from "@/constants/theme";
import type { ScenarioResult, TournamentWithPnL } from "@/types";

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

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

const losingScenario: ScenarioResult = {
  scenario: "realistic",
  round: "qf",
  prize_money: 300,
  prize_money_after_tax: 300,
  net_result: -300,
  profitable: false,
};

describe("TournamentCard", () => {
  it("labels a missing realistic projection with a neutral badge", () => {
    const screen = render(<TournamentCard tournament={tournament([])} />);
    const label = screen.getByText("Projection unavailable");

    expect(label.props.style).toEqual(
      expect.objectContaining({ color: colors.mutedForeground }),
    );
    expect(screen.queryByText("$0 USD")).toBeNull();
    expect(screen.getByText("Break-even: Projection unavailable")).toBeTruthy();
    expect(screen.queryByText("Break-even: No break-even round")).toBeNull();
  });

  it("keeps the no-break-even label when a real projection exists", () => {
    const screen = render(
      <TournamentCard tournament={tournament([losingScenario])} />,
    );

    expect(screen.getByText("Break-even: No break-even round")).toBeTruthy();
    expect(screen.queryByText("Break-even: Projection unavailable")).toBeNull();
  });

  it("keeps a real numeric zero as a non-loss badge", () => {
    const screen = render(
      <TournamentCard tournament={tournament([breakEvenScenario])} />,
    );
    const label = screen.getByText("$0 USD");

    expect(label.props.style).toEqual(
      expect.objectContaining({ color: colors.profit }),
    );
    expect(screen.queryByText("Projection unavailable")).toBeNull();
  });
});
