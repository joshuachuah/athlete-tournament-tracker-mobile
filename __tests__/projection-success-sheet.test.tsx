import { fireEvent, render } from "@testing-library/react-native";

import { ProjectionSuccessSheet } from "@/components/tournament/projection-success-sheet";
import type { TournamentWithPnL } from "@/types";

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

const saved: TournamentWithPnL = {
  id: "saved-1",
  user_id: "athlete-1",
  name: "Server Open",
  location: "Kuala Lumpur",
  country: "Malaysia",
  currency: "MYR",
  start_date: "2026-01-01",
  end_date: "2026-01-03",
  duration_days: 3,
  entry_fee: 100,
  flight_cost: 0,
  accommodation_total: 0,
  daily_spending_cap: 0,
  coaching_cost: 0,
  misc_cost: 0,
  subsidy_by: null,
  subsidy_amount: 0,
  subsidy_covers: null,
  sponsorship_allocated: 0,
  prize_rounds: { r2: 100 },
  prize_tax_rate: 30,
  created_at: "2026-01-01T00:00:00Z",
  home_currency: "MYR",
  pnl: {
    total_expenses: 100,
    total_income_base: 0,
    break_even_round: null,
    scenarios: [
      { scenario: "worst", round: "r2", prize_money: 100, prize_money_after_tax: 70, net_result: -30, profitable: false },
      { scenario: "realistic", round: "r2", prize_money: 100, prize_money_after_tax: 70, net_result: -30, profitable: false },
      { scenario: "best", round: "r2", prize_money: 100, prize_money_after_tax: 70, net_result: -30, profitable: false },
    ],
  },
};

it("renders the actual returned projection and delegates view or dismiss", () => {
  const onView = jest.fn();
  const onDismiss = jest.fn();
  const screen = render(
    <ProjectionSuccessSheet mode="create" tournament={saved} onView={onView} onDismiss={onDismiss} />,
  );

  expect(screen.getByText("Server Open now uses the server’s latest tax-aware P&L.")).toBeTruthy();
  expect(screen.getByText("Middle case")).toBeTruthy();
  expect(screen.getByText("R2")).toBeTruthy();
  expect(screen.queryByText("QF")).toBeNull();
  expect(screen.getByText("−MYR 30 MYR")).toBeTruthy();
  fireEvent.press(screen.getByText("View projection"));
  fireEvent.press(screen.getAllByLabelText("Dismiss saved projection")[0]);

  expect(onView).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("uses distinct update confirmation copy in edit mode", () => {
  const screen = render(
    <ProjectionSuccessSheet
      mode="edit"
      tournament={saved}
      onView={jest.fn()}
      onDismiss={jest.fn()}
    />,
  );

  expect(screen.getByText("Projection updated")).toBeTruthy();
  expect(screen.getByText("Server Open changes now use the server’s latest tax-aware P&L.")).toBeTruthy();
  expect(screen.getByLabelText("Server Open projection updated")).toBeTruthy();
  expect(screen.getByLabelText("Dismiss updated projection")).toBeTruthy();
});
