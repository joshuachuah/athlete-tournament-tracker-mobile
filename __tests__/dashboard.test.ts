import { createElement, type ReactNode } from "react";
import { render } from "@testing-library/react-native";

import DashboardScreen from "@/app/(tabs)/dashboard";
import { buildDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import type { AthleteProfile, TournamentWithPnL } from "@/types";

let mockTournaments: TournamentWithPnL[] = [];

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mockTournaments,
    error: null,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
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
    mockTournaments = [];
  });

  it("uses unavailable wording and never calls an all-missing season profitable", () => {
    mockTournaments = [tournament("missing", null, 0, 600)];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getAllByText("Projection unavailable")).not.toHaveLength(0);
    expect(screen.queryByText("Profitable season")).toBeNull();
    expect(screen.queryByText("Profitable on average")).toBeNull();
  });

  it("discloses mixed projection coverage alongside the aggregate", () => {
    mockTournaments = [
      tournament("projected", 250, 700, 450),
      tournament("missing", null, 0, 900),
    ];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getAllByText("$250 USD")).not.toHaveLength(0);
    expect(screen.getByText("Based on 1 of 2 events")).toBeTruthy();
    expect(screen.getByText("Projection coverage incomplete")).toBeTruthy();
  });

  it("labels a real numeric zero as break-even instead of unavailable", () => {
    mockTournaments = [tournament("break-even", 0, 600, 600)];

    const screen = render(createElement(DashboardScreen));

    expect(screen.getByText("Break-even season")).toBeTruthy();
    expect(screen.queryByText("Projection unavailable")).toBeNull();
  });
});
