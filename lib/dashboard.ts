import type { AthleteProfile, TournamentWithPnL } from "@/types";
import { dateOnlyYear, getScenario } from "@/lib/utils";

export type DashboardStats = {
  actualEarnings: number;
  actualExpenses: number;
  actualNet: number;
  actualCount: number;
  projectedNet: number;
  tournamentCount: number;
  projectedCount: number;
  unavailableCount: number;
  averageNetSpend: number;
  runway: number | null;
  profitableOnAverage: boolean;
};

export function buildDashboardStats(
  tournaments: TournamentWithPnL[],
  profile: AthleteProfile,
  today = new Date(),
): DashboardStats {
  const currentYear = today.getFullYear();
  const ytd = tournaments.filter(
    (tournament) => dateOnlyYear(tournament.start_date) === currentYear,
  );

  let actualEarnings = 0;
  let actualExpenses = 0;
  let actualNet = 0;
  let actualCount = 0;
  let projectedNet = 0;
  let projectedCount = 0;
  let unavailableCount = 0;

  for (const tournament of ytd) {
    if (tournament.actual_pnl) {
      actualEarnings += tournament.actual_pnl.total_income;
      actualExpenses += tournament.actual_pnl.total_expenses;
      actualNet += tournament.actual_pnl.net_result;
      actualCount += 1;
      continue;
    }

    const realistic = getScenario(tournament, "realistic");
    if (realistic) {
      projectedNet += realistic.net_result;
      projectedCount += 1;
    } else {
      unavailableCount += 1;
    }
  }

  let totalLosses = 0;
  let lossCount = 0;

  for (const tournament of tournaments) {
    const netResult =
      tournament.actual_pnl?.net_result ??
      getScenario(tournament, "realistic")?.net_result;

    if (netResult !== undefined && netResult < 0) {
      totalLosses += Math.abs(netResult);
      lossCount += 1;
    }
  }

  const averageNetSpend = lossCount > 0 ? totalLosses / lossCount : 0;

  return {
    actualEarnings,
    actualExpenses,
    actualNet,
    actualCount,
    projectedNet,
    tournamentCount: ytd.length,
    projectedCount,
    unavailableCount,
    averageNetSpend,
    runway:
      averageNetSpend > 0
        ? Math.floor(profile.savings_balance / averageNetSpend)
        : null,
    profitableOnAverage: averageNetSpend === 0,
  };
}
