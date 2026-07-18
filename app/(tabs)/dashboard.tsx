import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { RunwayBanner } from "@/components/dashboard/runway-banner";
import { StatCard } from "@/components/dashboard/stat-card";
import { TournamentCard } from "@/components/dashboard/tournament-card";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { buildDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const {
    data: tournaments = [],
    error,
    isError,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["tournaments", profile?.id],
    queryFn: ({ signal }) =>
      api.tournaments.list(profile?.id ?? "", { signal }),
    enabled: Boolean(profile?.id),
  });

  if (!profile) {
    return null;
  }

  const stats = buildDashboardStats(tournaments, profile);
  const currentYear = new Date().getFullYear();
  const hasProjections = stats.projectedCount > 0;
  const hasIncompleteCoverage = hasProjections && stats.unavailableCount > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
          Welcome back
        </Text>
        <Text
          style={{ color: colors.foreground, fontSize: 30, fontWeight: "700" }}
          selectable
        >
          {profile.name}
        </Text>
        <Text style={{ color: colors.mutedForeground }} selectable>
          {currentYear} Season Overview
        </Text>
      </View>

      {isLoading ? <LoadingState label="Loading tournaments" /> : null}
      {isError ? (
        <ErrorState
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      ) : null}

      {!isLoading && !isError ? (
        <>
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }} selectable>
              Season net · {currentYear}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 44,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              selectable
            >
              {hasProjections
                ? formatMoney(stats.netResult, profile.home_currency)
                : "Projection unavailable"}
            </Text>
            {!hasProjections ? (
              <Badge label="Projection unavailable" tone="neutral" />
            ) : hasIncompleteCoverage ? (
              <>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }} selectable>
                  Based on {stats.projectedCount} of {stats.tournamentCount} events
                </Text>
                <Badge label="Projection coverage incomplete" tone="neutral" />
              </>
            ) : (
              <Badge
                label={
                  stats.netResult > 0
                    ? "Profitable season"
                    : stats.netResult === 0
                      ? "Break-even season"
                      : "In the red"
                }
                tone={stats.netResult >= 0 ? "profit" : "loss"}
              />
            )}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            <StatCard
              label="Earned"
              value={formatMoney(stats.ytdEarnings, profile.home_currency)}
              detail="Server income total"
              tone="profit"
            />
            <StatCard
              label="Spent"
              value={formatMoney(stats.ytdExpenses, profile.home_currency)}
              detail="Server-adjusted spend"
              tone="loss"
            />
            <StatCard
              label="Events"
              value={String(stats.tournamentCount)}
              detail={`${stats.tournamentCount} this year`}
            />
          </View>

          {hasProjections ? (
            <RunwayBanner
              runway={stats.runway}
              averageNetSpend={stats.averageNetSpend}
              currency={profile.home_currency}
            />
          ) : null}

          <View style={{ gap: spacing.md }}>
            <Text
              style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}
              selectable
            >
              Tournaments
            </Text>
            {tournaments.length === 0 ? (
              <EmptyState
                title="No tournaments yet"
                body="Add a tournament to generate worst, realistic, and best-case projections."
                action={
                  <Link href="/tournaments/new/details" asChild>
                    <Button label="Add tournament" />
                  </Link>
                }
              />
            ) : (
              tournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
