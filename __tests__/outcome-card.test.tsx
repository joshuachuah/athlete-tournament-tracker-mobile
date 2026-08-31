import { render } from "@testing-library/react-native";

import {
  barFills,
  OutcomeCard,
} from "@/components/tournament/outcome-card";
import type {
  ActualPnl,
  PnLResult,
  ScenarioResult,
  TournamentResult,
} from "@/types";

const scenarios: ScenarioResult[] = [
  {
    scenario: "worst",
    round: "r1",
    prize_money: 725,
    prize_money_after_tax: 725,
    net_result: -100,
    profitable: false,
  },
  {
    scenario: "realistic",
    round: "r2",
    prize_money: 825,
    prize_money_after_tax: 825,
    net_result: 0,
    profitable: true,
  },
  {
    scenario: "best",
    round: "w",
    prize_money: 1325,
    prize_money_after_tax: 1325,
    net_result: 500,
    profitable: true,
  },
];

function projection(
  overrides: Partial<PnLResult> = {},
): PnLResult {
  return {
    total_expenses: 825,
    total_income_base: 0,
    break_even_round: "r2",
    scenarios,
    ...overrides,
  };
}

const result: TournamentResult = {
  id: "result-1",
  tournament_id: "tournament-1",
  user_id: "athlete-1",
  achieved_round: "qf",
  completed_at: "2026-04-03",
  prize_received_total: 300,
  subsidy_received_total: 0,
  sponsorship_received_total: 0,
  entry_fee_total: 100,
  flight_total: 200,
  accommodation_total: 300,
  food_total: 100,
  local_transport_total: 50,
  coaching_total: 0,
  misc_total: 0,
  created_at: "2026-04-03T00:00:00Z",
  updated_at: "2026-04-03T00:00:00Z",
};

const actualPnl: ActualPnl = {
  total_expenses: 750,
  total_income: 300,
  prize_received: 300,
  net_result: -450,
  profitable: false,
  home_currency: "USD",
};

it("renders three rows in draw order with signed amounts and codes", () => {
  const screen = render(
    <OutcomeCard
      status={{ kind: "live" }}
      body={{ kind: "projection", pnl: projection(), homeCurrency: "USD" }}
    />,
  );

  expect(screen.getByText("Out in R1")).toBeTruthy();
  expect(screen.getByText("Win")).toBeTruthy();
  expect(screen.getByText("−$100")).toBeTruthy();
  expect(screen.getByText("$0")).toBeTruthy();
  expect(screen.getByText("+$500")).toBeTruthy();
  expect(screen.getAllByText("USD")).toHaveLength(3);
  expect(screen.getByText("after $825 USD costs")).toBeTruthy();
  expect(
    screen.getByLabelText(/Projected loss −\$100 USD\.$/),
  ).toBeTruthy();
  expect(screen.getByLabelText(/Break even \$0 USD\.$/)).toBeTruthy();
  expect(
    screen.getByLabelText(/Projected gain \+\$500 USD\.$/),
  ).toBeTruthy();
});

it("sizes bars by share of the largest net", () => {
  const fills = barFills(
    scenarios.map((scenario, index) => ({
      ...scenario,
      net_result: [90.63, 866.06, 4954.69][index] ?? 0,
    })),
  );

  expect(fills[0]).toBe(3);
  expect(fills[1]).toBeCloseTo(17.48, 2);
  expect(fills[2]).toBe(100);
});

it("shows the break-even round and costs", () => {
  const withRound = render(
    <OutcomeCard
      status={{ kind: "live" }}
      body={{ kind: "projection", pnl: projection(), homeCurrency: "USD" }}
    />,
  );

  expect(withRound.getByText("Breaks even at R2")).toBeTruthy();
  expect(withRound.getByText("after $825 USD costs")).toBeTruthy();
  withRound.unmount();

  const withoutRound = render(
    <OutcomeCard
      status={{ kind: "saved" }}
      body={{
        kind: "projection",
        pnl: projection({ break_even_round: null }),
        homeCurrency: "USD",
      }}
    />,
  );

  expect(
    withoutRound.getByText("Doesn't break even at any round"),
  ).toBeTruthy();
});

it("renders a completed tournament", () => {
  const completed = render(
    <OutcomeCard
      status={{ kind: "saved" }}
      body={{ kind: "completed", result, actualPnl }}
    />,
  );

  expect(completed.getByText("Final loss")).toBeTruthy();
  expect(completed.getByText("−$450")).toBeTruthy();
  expect(completed.getByText("Out in QF")).toBeTruthy();
  expect(
    completed.getByText(/Income \$300 USD · Expenses \$750 USD/),
  ).toBeTruthy();
  expect(completed.getByText("Final outcome")).toBeTruthy();
  expect(completed.getByText(/^Completed /)).toBeTruthy();
  completed.unmount();

  const champion = render(
    <OutcomeCard
      status={{ kind: "saved" }}
      body={{
        kind: "completed",
        result: { ...result, achieved_round: "w" },
        actualPnl,
      }}
    />,
  );

  expect(champion.getByText("Champion")).toBeTruthy();
});

it("reflects status in the header", () => {
  const body = {
    kind: "projection" as const,
    pnl: projection(),
    homeCurrency: "USD",
  };
  const screen = render(
    <OutcomeCard status={{ kind: "updating" }} body={body} />,
  );

  expect(screen.getByText("Updating")).toBeTruthy();
  screen.rerender(
    <OutcomeCard status={{ kind: "unavailable" }} body={body} />,
  );
  expect(screen.getByText("Unavailable")).toBeTruthy();
  screen.rerender(<OutcomeCard status={{ kind: "saved" }} body={body} />);
  expect(screen.getByText("Saved projection")).toBeTruthy();
});
