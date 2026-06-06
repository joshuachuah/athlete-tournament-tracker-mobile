import { buildDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import type { AthleteProfile, TournamentWithPnL } from "@/types";

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
  realisticNet: number,
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
    created_at: "2026-01-01",
    home_currency: "USD",
    pnl: {
      total_income_base: income,
      total_expenses: expenses,
      break_even_round: realisticNet >= 0 ? "r2" : "qf",
      scenarios: [
        {
          scenario: "worst",
          round: "r1",
          prize_money: 0,
          net_result: -expenses,
          profitable: false,
        },
        {
          scenario: "realistic",
          round: "qf",
          prize_money: income,
          net_result: realisticNet,
          profitable: realisticNet >= 0,
        },
        {
          scenario: "best",
          round: "w",
          prize_money: income * 2,
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
  });

  it("keeps currency codes visible in money output", () => {
    expect(formatMoney(4800, "usd")).toBe("$4,800 USD");
  });
});
