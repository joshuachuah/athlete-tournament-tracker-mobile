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
import { errorMessage } from "@/lib/errors";
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
  const hasActuals = stats.actualCount > 0;
  const hasProjections = stats.projectedCount > 0;
  const isEmpty = stats.tournamentCount === 0;
  const actualTone = !hasActuals
    ? "neutral"
    : stats.actualNet > 0
      ? "profit"
      : stats.actualNet < 0
        ? "loss"
        : "neutral";
  const actualStatus = !hasActuals
    ? isEmpty
      ? "No result yet"
      : "No completed events"
    : stats.actualNet > 0
      ? "Profit"
      : stats.actualNet < 0
        ? "Loss"
        : "Break-even";
  const actualValue = hasActuals
    ? formatMoney(stats.actualNet, profile.home_currency)
    : "—";
  const netStatusBackgroundColor =
    actualTone === "profit"
      ? colors.profitSoft
      : actualTone === "loss"
        ? colors.lossSoft
        : colors.surfaceMuted;
  const netStatusColor =
    actualTone === "profit"
      ? colors.profit
      : actualTone === "loss"
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
          message={errorMessage(error, "Couldn't load your tournaments.")}
          onRetry={() => refetch()}
        />
      ) : null}

      {!isLoading && !hasBlockingError ? (
        <>
          <Card
            accessible
            accessibilityLabel={`Actual net. ${actualStatus}${hasActuals ? `, ${actualValue}` : ""}. ${stats.actualCount} completed of ${stats.tournamentCount} events. Projected net ${hasProjections ? formatMoney(stats.projectedNet, profile.home_currency) : "unavailable"}.`}
            style={{
              gap: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.md,
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
                Actual net
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
                  {actualValue}
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
                    {actualStatus}
                  </Text>
                </View>
              </View>
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
                  Completed
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
                  {stats.actualCount} of {stats.tournamentCount}
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
                  Projected net
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
                  {hasProjections
                    ? formatMoney(stats.projectedNet, profile.home_currency)
                    : "—"}
                </Text>
                <Text
                  style={{ color: colors.brandMutedForeground, fontSize: 11 }}
                  selectable
                >
                  {stats.projectedCount} projected
                  {stats.unavailableCount > 0
                    ? ` · ${stats.unavailableCount} need projection`
                    : ""}
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
              Actual earned {formatMoney(stats.actualEarnings, profile.home_currency)} · Actual spent{" "}
              {formatMoney(stats.actualExpenses, profile.home_currency)}
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
                body="Add a tournament to generate worst, middle, and best-case projections."
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
