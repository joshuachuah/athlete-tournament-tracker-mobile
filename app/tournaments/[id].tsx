import { Alert, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { ExpenseBreakdown } from "@/components/tournament/expense-breakdown";
import { MoneyPair } from "@/components/tournament/money-pair";
import { ScenarioCard } from "@/components/tournament/scenario-card";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import {
  formatDate,
  getScenario,
  roundLabels,
  scenarioLabel,
} from "@/lib/utils";
import type { Scenario } from "@/types";

const scenarioOrder: Scenario[] = ["worst", "realistic", "best"];

type DeleteTournamentVariables = {
  tournamentId: string;
  userId: string;
  profileId: string;
  authToken: string;
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
  const { profile, session } = useAuth();
  const tournamentId = typeof id === "string" ? id : "";

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
        authToken: variables.authToken,
      }),
    onSuccess: (_result, variables) => {
      if (session?.user.id !== variables.userId) {
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
    const authToken = session?.access_token;
    const profileId = profile?.id;

    if (!userId || !authToken || !profileId) {
      return;
    }

    const variables: DeleteTournamentVariables = {
      tournamentId,
      userId,
      profileId,
      authToken,
    };

    Alert.alert(
      "Delete tournament",
      "This removes the tournament from the server.",
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
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      ) : null}
      {deleteMutation.isError &&
      deleteMutation.variables?.userId === session.user.id ? (
        <ErrorState
          message={deleteMutation.error.message}
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
            {realistic ? (
              <Badge
                label={`${scenarioLabel(realistic.scenario)} net`}
                tone={realistic.profitable ? "profit" : "loss"}
              />
            ) : (
              <Badge label="Projection unavailable" tone="neutral" />
            )}
          </View>

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
                : "No break-even"}
            </Text>
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
              The server returns the minimum round needed to avoid losing money.
            </Text>
          </Card>

          {data.pnl.scenarios.length === 0 ? (
            <Card>
              <Text style={{ color: colors.mutedForeground }} selectable>
                Projection unavailable
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Text
                style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}
                selectable
              >
                Scenarios
              </Text>
              {scenarioOrder.map((scenario) => {
                const result = getScenario(data, scenario);
                return result ? (
                  <ScenarioCard
                    key={scenario}
                    result={result}
                    homeCurrency={data.home_currency}
                    tournamentCurrency={data.currency}
                    prizeTaxRate={data.prize_tax_rate}
                  />
                ) : null;
              })}
            </View>
          )}

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

          <ExpenseBreakdown tournament={data} />

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Button
              label="Edit"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/tournaments/new/details",
                  params: { editId: data.id },
                })
              }
            />
            <Button
              label="Delete"
              variant="danger"
              loading={deleteMutation.isPending}
              style={{ flex: 1 }}
              onPress={confirmDelete}
            />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
