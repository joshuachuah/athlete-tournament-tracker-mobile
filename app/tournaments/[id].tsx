import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { ExpenseBreakdown } from "@/components/tournament/expense-breakdown";
import { MoneyPair } from "@/components/tournament/money-pair";
import { OutcomeCard } from "@/components/tournament/outcome-card";
import { TournamentResultSheet } from "@/components/tournament/tournament-result-sheet";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { queryClient } from "@/lib/query-client";
import {
  formatDate,
  getScenario,
  roundLabels,
  scenarioLabel,
} from "@/lib/utils";

type DeleteTournamentVariables = {
  tournamentId: string;
  userId: string;
  profileId: string;
};

export default function TournamentDetailScreen() {
  return (
    <ProtectedScreen>
      <TournamentDetailContent />
    </ProtectedScreen>
  );
}

function TournamentDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isCurrentUser, profile, session } = useAuth();
  const tournamentId = typeof id === "string" ? id : "";
  const [resultEditorOpen, setResultEditorOpen] = useState(false);
  const [projectionExpanded, setProjectionExpanded] = useState(false);

  const {
    data,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: ({ signal }) => api.tournaments.get(tournamentId, { signal }),
    enabled: Boolean(tournamentId),
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: DeleteTournamentVariables) =>
      api.tournaments.delete(variables.tournamentId, {
        authenticatedUserId: variables.userId,
      }),
    onSuccess: (_result, variables) => {
      if (!isCurrentUser(variables.userId)) {
        return;
      }

      queryClient.removeQueries({
        queryKey: ["tournament", variables.tournamentId],
        exact: true,
      });
      queryClient.invalidateQueries({
        queryKey: ["tournaments", variables.profileId],
      });
      router.replace("/(tabs)/dashboard");
    },
  });

  if (!session || !profile) {
    return null;
  }

  function confirmDelete() {
    const userId = session?.user.id;
    const profileId = profile?.id;

    if (!userId || !profileId) {
      return;
    }

    const variables: DeleteTournamentVariables = {
      tournamentId,
      userId,
      profileId,
    };

    Alert.alert(
      "Delete tournament",
      "This permanently deletes the tournament, its projection, and any recorded result.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(variables),
        },
      ],
    );
  }

  const realistic = data ? getScenario(data, "realistic") : undefined;
  const hasProjection = data ? data.pnl.scenarios.length > 0 : false;
  const completed = Boolean(data?.result && data.actual_pnl);
  const finalNet = data?.actual_pnl?.net_result;
  const finalLabel =
    finalNet === undefined
      ? null
      : finalNet > 0
        ? "Final profit"
        : finalNet < 0
          ? "Final loss"
          : "Final break-even";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {isLoading ? <LoadingState label="Loading tournament" /> : null}
      {isError ? (
        <ErrorState
          message={errorMessage(error, "Couldn't load this tournament.")}
          onRetry={() => refetch()}
        />
      ) : null}
      {deleteMutation.isError &&
      deleteMutation.variables?.userId === session.user.id ? (
        <ErrorState
          message={errorMessage(
            deleteMutation.error,
            "Couldn't delete this tournament.",
          )}
          onRetry={confirmDelete}
        />
      ) : null}

      {data ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                fontWeight: "800",
                textTransform: "uppercase",
              }}
            >
              Tournament
            </Text>
            <Text
              style={{ color: colors.foreground, fontSize: 32, fontWeight: "900" }}
              selectable
            >
              {data.name}
            </Text>
            <Text style={{ color: colors.mutedForeground }} selectable>
              {data.location}, {data.country} · {formatDate(data.start_date)}
            </Text>
            {data.actual_pnl && finalLabel ? (
              <Badge
                label={finalLabel}
                tone={
                  data.actual_pnl.net_result > 0
                    ? "profit"
                    : data.actual_pnl.net_result < 0
                      ? "loss"
                      : "neutral"
                }
              />
            ) : realistic ? (
              <Badge
                label={`${scenarioLabel(realistic.scenario)} net`}
                tone={realistic.profitable ? "profit" : "loss"}
              />
            ) : (
              <Badge label="Projection unavailable" tone="neutral" />
            )}
          </View>

          {data.actual_pnl && data.result && finalLabel ? (
            <OutcomeCard
              status={{ kind: "saved" }}
              body={{
                kind: "completed",
                result: data.result,
                actualPnl: data.actual_pnl,
              }}
            />
          ) : null}

          {completed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: projectionExpanded }}
              onPress={() => setProjectionExpanded((expanded) => !expanded)}
              style={({ pressed }) => [
                styles.projectionToggle,
                pressed && styles.projectionTogglePressed,
              ]}
            >
              <Text style={styles.projectionToggleLabel}>
                {projectionExpanded
                  ? "Hide original projection"
                  : "View original projection"}
              </Text>
              {projectionExpanded ? (
                <ChevronUp
                  size={18}
                  color={colors.brand}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : (
                <ChevronDown
                  size={18}
                  color={colors.brand}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </Pressable>
          ) : null}

          {!completed || projectionExpanded ? (
            <>
              {completed ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  Saved before the tournament
                </Text>
              ) : null}
              <Card>
                <Text
                  style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}
                  selectable
                >
                  Break-even round
                </Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 28,
                    fontWeight: "900",
                  }}
                  selectable
                >
                  {data.pnl.break_even_round
                    ? roundLabels[data.pnl.break_even_round]
                    : hasProjection
                      ? "No break-even"
                      : "Projection unavailable"}
                </Text>
                <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
                  This is the minimum round needed to avoid losing money.
                </Text>
              </Card>

              <ExpenseBreakdown tournament={data} />

              <OutcomeCard
                status={{ kind: "saved" }}
                body={
                  data.pnl.scenarios.length === 0
                    ? {
                        kind: "message",
                        children: (
                          <Text style={{ color: colors.mutedForeground }} selectable>
                            Projection unavailable
                          </Text>
                        ),
                      }
                    : {
                        kind: "projection",
                        pnl: data.pnl,
                        homeCurrency: data.home_currency,
                      }
                }
              />

              <Card>
                <Text
                  style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}
                  selectable
                >
                  Income and expenses
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xl }}>
                  <MoneyPair
                    label="Total income"
                    amount={data.pnl.total_income_base}
                    fromCurrency={data.home_currency}
                    toCurrency={data.currency}
                  />
                  <MoneyPair
                    label="Total expenses"
                    amount={data.pnl.total_expenses}
                    fromCurrency={data.home_currency}
                    toCurrency={data.currency}
                  />
                </View>
              </Card>
            </>
          ) : null}

          <Button
            label={data.result ? "Edit result" : "Record result"}
            onPress={() => setResultEditorOpen(true)}
          />

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {!data.result ? (
              <Button
                label="Edit projection"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: "/tournaments/new/details",
                    params: { editId: data.id },
                  })
                }
              />
            ) : null}
            <Button
              label="Delete"
              variant="danger"
              loading={deleteMutation.isPending}
              style={{ flex: 1 }}
              onPress={confirmDelete}
            />
          </View>

          {resultEditorOpen ? (
            <TournamentResultSheet
              authenticatedUserId={session.user.id}
              onClose={() => setResultEditorOpen(false)}
              profileId={profile.id}
              tournament={data}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  projectionToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    gap: spacing.md,
  },
  projectionTogglePressed: {
    opacity: 0.7,
  },
  projectionToggleLabel: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "600",
  },
});
