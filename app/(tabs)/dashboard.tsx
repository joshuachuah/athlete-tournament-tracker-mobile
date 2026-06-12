import { Link, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
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
  const { profile, session } = useAuth();
  const {
    data: tournaments = [],
    error,
    isError,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["tournaments", profile?.id],
    queryFn: () => api.tournaments.list(profile?.id ?? ""),
    enabled: Boolean(profile?.id),
  });

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const stats = buildDashboardStats(tournaments, profile);
  const currentYear = new Date().getFullYear();

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
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          Welcome back
        </Text>
        <Text
          style={{ color: colors.foreground, fontSize: 32, fontWeight: "900" }}
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            <StatCard
              label="YTD Earnings"
              value={formatMoney(stats.ytdEarnings, profile.home_currency)}
              detail="Server income total"
              tone="profit"
            />
            <StatCard
              label="YTD Expenses"
              value={formatMoney(stats.ytdExpenses, profile.home_currency)}
              detail="Server-adjusted spend"
              tone="loss"
            />
            <StatCard
              label="Net Result"
              value={formatMoney(stats.netResult, profile.home_currency)}
              detail={stats.netResult >= 0 ? "Profitable season" : "In the red"}
              tone={stats.netResult >= 0 ? "profit" : "loss"}
            />
            <StatCard
              label="Tournaments"
              value={String(stats.tournamentCount)}
              detail={`${stats.tournamentCount} this year`}
            />
          </View>

          <RunwayBanner
            runway={stats.runway}
            averageNetSpend={stats.averageNetSpend}
            currency={profile.home_currency}
          />

          <View style={{ gap: spacing.md }}>
            <Text
              style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}
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
