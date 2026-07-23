import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { TournamentCard } from "@/components/dashboard/tournament-card";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { buildDashboardStats } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const {
    data: tournamentData,
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

  const tournaments = tournamentData ?? [];
  const hasTournamentData = tournamentData !== undefined;
  const hasBlockingError = isError && !hasTournamentData;
  const stats = buildDashboardStats(tournaments, profile);
  const currentYear = new Date().getFullYear();
  const hasProjections = stats.projectedCount > 0;
  const hasIncompleteCoverage = hasProjections && stats.unavailableCount > 0;
  const isEmpty = stats.tournamentCount === 0;
  const netTone = !hasProjections
    ? "neutral"
    : stats.netResult > 0
      ? "profit"
      : stats.netResult < 0
        ? "loss"
        : "neutral";
  const netLabel = !hasProjections
    ? isEmpty
      ? "No result yet"
      : "Needs projection"
    : stats.netResult > 0
      ? `Profit · ${formatMoney(stats.netResult, profile.home_currency)}`
      : stats.netResult < 0
        ? `Loss · ${formatMoney(stats.netResult, profile.home_currency)}`
        : `Break-even · ${formatMoney(stats.netResult, profile.home_currency)}`;
  const netBackgroundColor =
    netTone === "profit"
      ? colors.profitSoft
      : netTone === "loss"
        ? colors.lossSoft
        : colors.surfaceMuted;

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
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }} selectable>
          {currentYear} season
        </Text>
        <Text
          style={{ color: colors.foreground, fontSize: 30, fontWeight: "700" }}
          accessibilityRole="header"
          selectable
        >
          Dashboard
        </Text>
      </View>

      {isLoading ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Loading tournaments"
        >
          <LoadingState label="Loading tournaments" />
        </View>
      ) : null}
      {isError ? (
        <ErrorState
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      ) : null}

      {!isLoading && !hasBlockingError ? (
        <>
          <Card
            style={{
              gap: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.lg,
              boxShadow: "none",
            }}
          >
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{ color: colors.mutedForeground, fontSize: 13 }}
                selectable
              >
                Net result
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "100%",
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.sm,
                  backgroundColor: netBackgroundColor,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 22,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  selectable
                >
                  {netLabel}
                </Text>
              </View>
              {hasIncompleteCoverage ? (
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  selectable
                >
                  Partial result from projected events
                </Text>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: "row",
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  selectable
                >
                  Events
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 20,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                  selectable
                >
                  {stats.tournamentCount}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  gap: spacing.xs,
                  paddingLeft: spacing.lg,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                }}
              >
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  selectable
                >
                  Projected coverage
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 20,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                  selectable
                >
                  {stats.projectedCount} of {stats.tournamentCount}
                </Text>
              </View>
            </View>

            <Text
              style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}
              selectable
            >
              Earned {formatMoney(stats.ytdEarnings, profile.home_currency)} · Spent{" "}
              {formatMoney(stats.ytdExpenses, profile.home_currency)}
            </Text>
          </Card>

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
