import type { AthleteProfile, TournamentWithPnL } from "@/types";
import { getScenario } from "@/lib/utils";

export type DashboardStats = {
  ytdEarnings: number;
  ytdExpenses: number;
  netResult: number;
  tournamentCount: number;
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
    (tournament) => new Date(tournament.start_date).getFullYear() === currentYear,
  );

  const ytdEarnings = ytd.reduce(
    (sum, tournament) => sum + tournament.pnl.total_income_base,
    0,
  );
  const ytdExpenses = ytd.reduce(
    (sum, tournament) => sum + tournament.pnl.total_expenses,
    0,
  );
  const netResult = ytd.reduce((sum, tournament) => {
    const realistic = getScenario(tournament, "realistic");
    return sum + (realistic?.net_result ?? 0);
  }, 0);

  const losses = tournaments
    .map((tournament) => getScenario(tournament, "realistic")?.net_result ?? 0)
    .filter((netResultForTournament) => netResultForTournament < 0)
    .map((loss) => Math.abs(loss));

  const averageNetSpend =
    losses.length > 0
      ? losses.reduce((sum, loss) => sum + loss, 0) / losses.length
      : 0;

  return {
    ytdEarnings,
    ytdExpenses,
    netResult,
    tournamentCount: ytd.length,
    averageNetSpend,
    runway:
      averageNetSpend > 0
        ? Math.floor(profile.savings_balance / averageNetSpend)
        : null,
    profitableOnAverage: averageNetSpend === 0,
  };
}
