import { render } from "@testing-library/react-native";

import { ExpenseBreakdown } from "@/components/tournament/expense-breakdown";
import type { TournamentWithPnL } from "@/types";

it("renders category amounts without calculating FX in the client", () => {
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
    food_total: 120,
    local_transport_total: 60,
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

  const screen = render(<ExpenseBreakdown tournament={tournament} />);

  expect(screen.getByText("Food")).toBeTruthy();
  expect(screen.getByText("Local transport")).toBeTruthy();
  expect(screen.getByText("Other daily spending")).toBeTruthy();
  expect(screen.getByText("Category amounts in EUR")).toBeTruthy();

  expect(screen.getByText("€150 EUR")).toBeTruthy();
  expect(screen.getByText("€120 EUR")).toBeTruthy();
  expect(screen.getByText("€60 EUR")).toBeTruthy();
  expect(screen.getByText("$700 USD")).toBeTruthy();
});
