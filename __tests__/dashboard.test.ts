import { createElement, type ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import DashboardScreen from "@/app/(tabs)/dashboard";
import { buildDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import type { AthleteProfile, TournamentWithPnL } from "@/types";

let mockTournaments: TournamentWithPnL[] | undefined = [];
const mockRefetch = jest.fn();
let mockQueryState = {
  error: null as Error | null,
  isError: false,
  isLoading: false,
  isRefetching: false,
};

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mockTournaments,
    ...mockQueryState,
    refetch: mockRefetch,
  }),
}));

jest.mock("@/context/auth", () => ({
  useAuth: () => ({
    profile,
    session: { user: { email: profile.email, id: profile.id } },
  }),
}));

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  Redirect: () => null,
}));

const profile: AthleteProfile = {
  id: "athlete-1",
  email: "athlete@example.com",
  name: "Alex Runner",
  home_country: "United States",
  home_currency: "USD",
  sport: "Squash",
  monthly_income: 0,
  savings_balance: 3000,
  monthly_sponsorship: 0,
  created_at: "2026-01-01",
};

function tournament(
  id: string,
  realisticNet: number | null,
  income: number,
  expenses: number,
): TournamentWithPnL {
  return {
    id,
    user_id: profile.id,
    name: `Tournament ${id}`,
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
    prize_rounds: { r1: 0, r2: 100, qf: 300, w: 900 },
    prize_tax_rate: 0,
    created_at: "2026-01-01",
    home_currency: "USD",
    pnl: {
      total_income_base: income,
      total_expenses: expenses,
      break_even_round:
        realisticNet === null ? null : realisticNet >= 0 ? "r2" : "qf",
      scenarios:
        realisticNet === null
          ? []
          : [
              {
                scenario: "worst",
                round: "r1",
                prize_money: 0,
                prize_money_after_tax: 0,
                net_result: -expenses,
                profitable: false,
              },
              {
                scenario: "realistic",
                round: "qf",
                prize_money: income,
                prize_money_after_tax: income,
                net_result: realisticNet,
                profitable: realisticNet >= 0,
              },
              {
                scenario: "best",
                round: "w",
                prize_money: income * 2,
                prize_money_after_tax: income * 2,
                net_result: income * 2 - expenses,
                profitable: income * 2 - expenses >= 0,
              },
            ],
    },
  };
}

function dashboardTournament(
  id: string,
  realisticNet: number | null,
  income: number,
  expenses: number,
) {
  const item = tournament(id, realisticNet, income, expenses);
  item.start_date = `${new Date().getFullYear()}-04-01`;
  item.end_date = `${new Date().getFullYear()}-04-03`;
  return item;
}

describe("dashboard stats", () => {
  it("uses server P&L scenarios for net result and runway", () => {
    const stats = buildDashboardStats(
      [tournament("a", -500, 700, 1200), tournament("b", -1000, 400, 1400)],
      profile,
      new Date("2026-06-02"),
    );

    expect(stats.ytdEarnings).toBe(1100);
    expect(stats.ytdExpenses).toBe(2600);
    expect(stats.netResult).toBe(-1500);
    expect(stats.averageNetSpend).toBe(750);
    expect(stats.runway).toBe(4);
    expect(stats.projectedCount).toBe(2);
    expect(stats.unavailableCount).toBe(0);
  });

  it("marks a single empty scenario set as unavailable instead of projected zero", () => {
    const stats = buildDashboardStats(
      [tournament("missing", null, 0, 600)],
      profile,
      new Date("2026-06-02"),
    );

    expect(stats.netResult).toBe(0);
    expect(stats.projectedCount).toBe(0);
    expect(stats.unavailableCount).toBe(1);
  });

  it("reports all season projections as unavailable", () => {
    const stats = buildDashboardStats(
      [
        tournament("missing-a", null, 0, 600),
        tournament("missing-b", null, 0, 800),
      ],
      profile,
      new Date("2026-06-02"),
    );

    expect(stats.netResult).toBe(0);
    expect(stats.projectedCount).toBe(0);
    expect(stats.unavailableCount).toBe(2);
  });

  it("aggregates a mixed season from projected events and carries coverage", () => {
    const stats = buildDashboardStats(
      [
        tournament("projected", 250, 700, 450),
        tournament("missing", null, 0, 900),
      ],
      profile,
      new Date("2026-06-02"),
    );

    expect(stats.netResult).toBe(250);
    expect(stats.projectedCount).toBe(1);
    expect(stats.unavailableCount).toBe(1);
    expect(stats.tournamentCount).toBe(2);
  });

  it("keeps a real numeric zero distinguishable from unavailable data", () => {
    const stats = buildDashboardStats(
      [tournament("break-even", 0, 600, 600)],
      profile,
      new Date("2026-06-02"),
    );

    expect(stats.netResult).toBe(0);
    expect(stats.projectedCount).toBe(1);
    expect(stats.unavailableCount).toBe(0);
  });

  it("keeps currency codes visible in money output", () => {
    expect(formatMoney(4800, "usd")).toBe("$4,800 USD");
  });

  it("filters year-boundary date-only values without UTC rollover", () => {
    const previousYear = tournament("previous", 100, 100, 0);
    previousYear.start_date = "2025-12-31";
    const currentYear = tournament("current", 200, 200, 0);
    currentYear.start_date = "2026-01-01";
    const invalid = tournament("invalid", 300, 300, 0);
    invalid.start_date = "not-a-date";

    const stats = buildDashboardStats(
      [previousYear, currentYear, invalid],
      profile,
      new Date(2026, 0, 1),
    );

    expect(stats.tournamentCount).toBe(1);
    expect(stats.ytdEarnings).toBe(200);
    expect(stats.netResult).toBe(200);
  });
});

describe("dashboard projection presentation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTournaments = [];
    mockQueryState = {
      error: null,
      isError: false,
      isLoading: false,
      isRefetching: false,
    };
  });

  it("renders the compact header, full scorecard, and outcome-only rows", () => {
    mockTournaments = [
      dashboardTournament("profit", 500, 700, 200),
      dashboardTournament("loss", -200, 100, 300),
    ];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText(`${new Date().getFullYear()} season`)).toBeTruthy();
    expect(screen.getByRole("header", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(screen.queryByText(profile.name)).toBeNull();

    expect(screen.getByText("$300 USD")).toBeTruthy();
    expect(screen.getByText("Profit")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Net result. Profit, $300 USD. 2 events. Projected coverage 2 of 2.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.getByText("Earned $800 USD · Spent $500 USD")).toBeTruthy();
    expect(screen.getByText("Profit · $500 USD")).toBeTruthy();
    expect(screen.getByText("Loss · -$200 USD")).toBeTruthy();

    expect(screen.queryByText("Runway")).toBeNull();
    expect(screen.queryByText("Worst")).toBeNull();
    expect(screen.queryByText("Realistic")).toBeNull();
    expect(screen.queryByText(/Break-even:/)).toBeNull();
  });

  it("qualifies an incomplete aggregate and marks the missing row", () => {
    mockTournaments = [
      dashboardTournament("projected", 250, 700, 450),
      dashboardTournament("missing", null, 0, 900),
    ];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("$250 USD")).toBeTruthy();
    expect(screen.getByText("Profit")).toBeTruthy();
    expect(screen.getByText("Profit · $250 USD")).toBeTruthy();
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("Partial result from projected events")).toBeTruthy();
    expect(screen.getByText("Needs projection")).toBeTruthy();
  });

  it("never turns an all-missing season into a fake zero outcome", () => {
    mockTournaments = [
      dashboardTournament("missing-a", null, 0, 600),
      dashboardTournament("missing-b", null, 0, 800),
    ];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("0 of 2")).toBeTruthy();
    expect(screen.getAllByText("Needs projection")).toHaveLength(3);
    expect(screen.queryByText("Break-even · $0 USD")).toBeNull();
    expect(screen.queryByText(/^Profit ·/)).toBeNull();
    expect(screen.queryByText(/^Loss ·/)).toBeNull();
  });

  it("keeps a real numeric zero visible and explicitly break-even", () => {
    mockTournaments = [dashboardTournament("break-even", 0, 600, 600)];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("$0 USD")).toBeTruthy();
    expect(screen.getByText("Break-even")).toBeTruthy();
    expect(screen.getByText("Break-even · $0 USD")).toBeTruthy();
    expect(screen.getByText("1 of 1")).toBeTruthy();
    expect(screen.queryByText("Needs projection")).toBeNull();
  });

  it("keeps the empty state distinct from missing projections", () => {
    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("No result yet")).toBeTruthy();
    expect(screen.getByText("0 of 0")).toBeTruthy();
    expect(screen.getByText("No tournaments yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add tournament" })).toBeTruthy();
    expect(screen.queryByText("Needs projection")).toBeNull();
  });

  it("shows loading without scorecard or empty-state content", () => {
    mockQueryState.isLoading = true;

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByRole("progressbar", { name: "Loading tournaments" })).toBeTruthy();
    expect(screen.queryByText("Net result")).toBeNull();
    expect(screen.queryByText("No tournaments yet")).toBeNull();
  });

  it("announces an error and retries without showing stale dashboard states", () => {
    mockTournaments = undefined;
    mockQueryState = {
      ...mockQueryState,
      error: new Error("Network unavailable"),
      isError: true,
    };

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Network unavailable")).toBeTruthy();
    expect(screen.queryByText("Net result")).toBeNull();
    expect(screen.queryByText("No tournaments yet")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached content visible after a failed refresh", () => {
    mockTournaments = [dashboardTournament("projected", 250, 700, 450)];
    mockQueryState = {
      ...mockQueryState,
      error: new Error("Refresh failed"),
      isError: true,
    };

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("$250 USD")).toBeTruthy();
    expect(screen.getByText("Profit")).toBeTruthy();
    expect(screen.getByText("Profit · $250 USD")).toBeTruthy();
    expect(screen.getByText("1 of 1")).toBeTruthy();
    expect(screen.getByText("Refresh failed")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a cached empty result visible after a failed refresh", () => {
    mockQueryState = {
      ...mockQueryState,
      error: new Error("Refresh failed"),
      isError: true,
    };

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("No result yet")).toBeTruthy();
    expect(screen.getByText("No tournaments yet")).toBeTruthy();
    expect(screen.getByText("Refresh failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps content visible and wires pull-to-refresh while refetching", () => {
    mockTournaments = [dashboardTournament("projected", 250, 700, 450)];
    mockQueryState.isRefetching = true;

    const screen = render(createElement(DashboardScreen));
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);

    expect(refreshControl.props.refreshing).toBe(true);
    expect(screen.getByText("$250 USD")).toBeTruthy();
    expect(screen.getByText("Profit")).toBeTruthy();
    expect(screen.getByText("Profit · $250 USD")).toBeTruthy();
    fireEvent(refreshControl, "refresh");
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
