import { render } from "@testing-library/react-native";

import { ExpenseBreakdown } from "@/components/tournament/expense-breakdown";
import { MoneyPair } from "@/components/tournament/money-pair";
import type { TournamentWithPnL } from "@/types";

jest.mock("@/components/tournament/money-pair", () => ({
  MoneyPair: jest.fn(() => null),
}));

const mockMoneyPair = MoneyPair as jest.Mock;

it("renders flat expenses in tournament currency before converting to home currency", () => {
  const tournament = {
    id: "tournament-1",
    user_id: "athlete-1",
    name: "European Open",
    location: "Paris",
    country: "France",
    currency: "EUR",
    home_currency: "USD",
    start_date: "2026-04-01",
    end_date: "2026-04-03",
    duration_days: 3,
    entry_fee: 100,
    flight_cost: 200,
    accommodation_total: 300,
    daily_spending_cap: 50,
    coaching_cost: 25,
    misc_cost: 10,
    subsidy_by: null,
    subsidy_amount: 0,
    subsidy_covers: null,
    sponsorship_allocated: 0,
    prize_rounds: {},
    prize_tax_rate: 0,
    created_at: "2026-01-01T00:00:00Z",
    pnl: {
      total_income_base: 0,
      total_expenses: 700,
      scenarios: [],
      break_even_round: null,
    },
  } satisfies TournamentWithPnL;

  render(<ExpenseBreakdown tournament={tournament} />);

  expect(mockMoneyPair).toHaveBeenCalledTimes(6);
  for (const [props] of mockMoneyPair.mock.calls) {
    expect(props).toEqual(
      expect.objectContaining({
        fromCurrency: "EUR",
        toCurrency: "USD",
      }),
    );
  }
  expect(mockMoneyPair).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 150 }),
    undefined,
  );
});
