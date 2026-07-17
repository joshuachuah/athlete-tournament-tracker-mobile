import type { AthleteProfile, TournamentWithPnL } from "@/types";
import { dateOnlyYear, getScenario } from "@/lib/utils";

export type DashboardStats = {
  ytdEarnings: number;
  ytdExpenses: number;
  netResult: number;
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

  const ytdEarnings = ytd.reduce(
    (sum, tournament) => sum + tournament.pnl.total_income_base,
    0,
  );
  const ytdExpenses = ytd.reduce(
    (sum, tournament) => sum + tournament.pnl.total_expenses,
    0,
  );
  const projectedCount = ytd.reduce((count, tournament) => {
    return count + (getScenario(tournament, "realistic") ? 1 : 0);
  }, 0);
  const unavailableCount = ytd.length - projectedCount;
  const netResult = ytd.reduce((sum, tournament) => {
    const realistic = getScenario(tournament, "realistic");
    return realistic ? sum + realistic.net_result : sum;
  }, 0);

  let totalLosses = 0;
  let lossCount = 0;

  for (const tournament of tournaments) {
    const realistic = getScenario(tournament, "realistic");

    if (realistic && realistic.net_result < 0) {
      totalLosses += Math.abs(realistic.net_result);
      lossCount += 1;
    }
  }

  const averageNetSpend = lossCount > 0 ? totalLosses / lossCount : 0;

  return {
    ytdEarnings,
    ytdExpenses,
    netResult,
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
