import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

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

const profitableScenario: ScenarioResult = {
  scenario: "realistic",
  round: "qf",
  prize_money: 900,
  prize_money_after_tax: 900,
  net_result: 300,
  profitable: true,
};

const worstScenario: ScenarioResult = {
  scenario: "worst",
  round: "r1",
  prize_money: 0,
  prize_money_after_tax: 0,
  net_result: -600,
  profitable: false,
};

const bestScenario: ScenarioResult = {
  scenario: "best",
  round: "w",
  prize_money: 1200,
  prize_money_after_tax: 1200,
  net_result: 600,
  profitable: true,
};

describe("TournamentCard", () => {
  it("labels a missing realistic projection with a neutral outcome", () => {
    const screen = render(
      <TournamentCard tournament={tournament([worstScenario, bestScenario])} />,
    );
    const label = screen.getByText("Needs projection");

    expect(StyleSheet.flatten(label.props.style)).toEqual(
      expect.objectContaining({ color: colors.foreground }),
    );
    expect(screen.queryByText("$0 USD")).toBeNull();
    expect(screen.queryByText("Worst")).toBeNull();
    expect(screen.queryByText("Best")).toBeNull();
    expect(screen.queryByText(/Break-even:/)).toBeNull();
  });

  it("uses an explicit loss outcome without the old detail stack", () => {
    const screen = render(
      <TournamentCard tournament={tournament([losingScenario])} />,
    );

    expect(screen.getByText("Loss · -$300 USD")).toBeTruthy();
    expect(screen.queryByText(/Break-even:/)).toBeNull();
  });

  it("keeps a real numeric zero as an explicit break-even outcome", () => {
    const screen = render(
      <TournamentCard tournament={tournament([breakEvenScenario])} />,
    );
    const label = screen.getByText("Break-even · $0 USD");

    expect(StyleSheet.flatten(label.props.style)).toEqual(
      expect.objectContaining({ color: colors.foreground }),
    );
    expect(screen.queryByText("Needs projection")).toBeNull();
  });

  it("renders the compact outcome row with accessible navigation context", () => {
    const screen = render(
      <TournamentCard tournament={tournament([profitableScenario])} />,
    );

    expect(screen.getByText("Open Championship")).toBeTruthy();
    expect(screen.getByText("Detroit · Apr 1, 2026")).toBeTruthy();
    expect(screen.getByText("Profit · $300 USD")).toBeTruthy();

    const link = screen.getByRole("link");
    expect(link.props.accessibilityLabel).toBe(
      "Open Championship. Detroit, Apr 1, 2026. middle-case net Profit · $300 USD.",
    );
    expect(link.props.accessibilityHint).toBe("Opens tournament details");
  });
});
