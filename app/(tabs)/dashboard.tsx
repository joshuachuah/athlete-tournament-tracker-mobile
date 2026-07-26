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
  const netStatus = !hasProjections
    ? isEmpty
      ? "No result yet"
      : "Needs projection"
    : stats.netResult > 0
      ? "Profit"
      : stats.netResult < 0
        ? "Loss"
        : "Break-even";
  const netValue = hasProjections
    ? formatMoney(stats.netResult, profile.home_currency)
    : "—";
  const netStatusBackgroundColor =
    netTone === "profit"
      ? colors.profitSoft
      : netTone === "loss"
        ? colors.lossSoft
        : colors.surfaceMuted;
  const netStatusColor =
    netTone === "profit"
      ? colors.profit
      : netTone === "loss"
        ? colors.loss
        : colors.foreground;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      contentContainerStyle={{
        flexGrow: 1,
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
            accessible
            accessibilityLabel={`Net result. ${netStatus}${hasProjections ? `, ${netValue}` : ""}. ${stats.tournamentCount} events. Projected coverage ${stats.projectedCount} of ${stats.tournamentCount}.`}
            style={{
              gap: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.lg,
              backgroundColor: colors.brand,
              boxShadow:
                "0 2px 5px rgba(16, 23, 18, 0.10), 0 22px 42px -24px rgba(23, 63, 49, 0.70)",
            }}
          >
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  color: colors.brandMutedForeground,
                  fontSize: 13,
                  fontWeight: "700",
                }}
                selectable
              >
                Net result
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text
                  style={{
                    minWidth: 0,
                    flexShrink: 1,
                    color: colors.brandForeground,
                    fontSize: 34,
                    fontWeight: "800",
                    letterSpacing: -0.8,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  selectable
                >
                  {netValue}
                </Text>
                <View
                  style={{
                    flexShrink: 0,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: netStatusBackgroundColor,
                  }}
                >
                  <Text
                    style={{
                      color: netStatusColor,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                    selectable
                  >
                    {netStatus}
                  </Text>
                </View>
              </View>
              {hasIncompleteCoverage ? (
                <Text
                  style={{ color: colors.brandMutedForeground, fontSize: 12 }}
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
                borderTopColor: colors.brandBorder,
              }}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  style={{ color: colors.brandMutedForeground, fontSize: 12 }}
                  selectable
                >
                  Events
                </Text>
                <Text
                  style={{
                    color: colors.brandForeground,
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
                  borderLeftColor: colors.brandBorder,
                }}
              >
                <Text
                  style={{ color: colors.brandMutedForeground, fontSize: 12 }}
                  selectable
                >
                  Projected coverage
                </Text>
                <Text
                  style={{
                    color: colors.brandForeground,
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
              style={{
                color: colors.brandMutedForeground,
                fontSize: 12,
                lineHeight: 18,
              }}
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
                  <Link href="/(tabs)/add" asChild>
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
