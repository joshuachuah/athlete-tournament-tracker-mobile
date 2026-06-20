import { Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/state";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import type { KnownTournament } from "@/types";
import { useState } from "react";

function prefillTournament(tournament: KnownTournament) {
  router.push({
    pathname: "/tournaments/new/details",
    params: {
      name: tournament.name,
      location: tournament.location ?? "",
      country: tournament.country ?? "",
      currency: tournament.currency ?? "USD",
      start_date: tournament.start_date ?? "",
      end_date: tournament.end_date ?? "",
      duration_days: tournament.duration_days
        ? String(tournament.duration_days)
        : undefined,
      prize_rounds: tournament.prize_rounds
        ? JSON.stringify(tournament.prize_rounds)
        : undefined,
      prize_tax_rate:
        tournament.prize_tax_rate === undefined
          ? undefined
          : String(tournament.prize_tax_rate),
    },
  });
}

function tournamentKey(tournament: KnownTournament): string {
  if (tournament.id) {
    return tournament.id;
  }

  return JSON.stringify([
    tournament.name,
    tournament.location,
    tournament.country,
    tournament.start_date,
    tournament.end_date,
    tournament.tier,
    tournament.tour_level,
  ]);
}

export default function SearchScreen() {
  const { profile, session } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["tournament-search", debouncedQuery, profile?.sport],
    queryFn: () => api.tournaments.search(debouncedQuery, profile?.sport),
    enabled: debouncedQuery.length >= 2,
  });

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Input
        label="Tournament search"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        placeholder="Search by tournament name"
      />

      {resultsLoading ? <LoadingState label="Searching tournaments" /> : null}

      {debouncedQuery.length < 2 ? (
        <EmptyState
          title="Start typing"
          body="Enter at least two characters to search known and live tournament records."
        />
      ) : null}

      {results?.length === 0 ? (
        <EmptyState
          title="No matches"
          body="Start from scratch if this tournament is not in the server search results."
        />
      ) : null}

      <View style={{ gap: spacing.md }}>
        {results?.map((tournament) => (
          <Pressable
            key={tournamentKey(tournament)}
            onPress={() => prefillTournament(tournament)}
          >
            {({ pressed }) => (
              <Card style={{ opacity: pressed ? 0.75 : 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 18,
                        fontWeight: "800",
                      }}
                      selectable
                    >
                      {tournament.name}
                    </Text>
                    <Text style={{ color: colors.mutedForeground }} selectable>
                      {tournament.location ?? "Location unknown"}
                    </Text>
                    {tournament.start_date ? (
                      <Text style={{ color: colors.mutedForeground }} selectable>
                        {formatDate(tournament.start_date)}
                      </Text>
                    ) : null}
                  </View>
                  {tournament.tier || tournament.tour_level ? (
                    <Badge
                      label={tournament.tier ?? tournament.tour_level ?? ""}
                      tone="accent"
                    />
                  ) : null}
                </View>
                {tournament.estimated_prize_total && tournament.currency ? (
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                    selectable
                  >
                    Estimated prize total:{" "}
                    {formatMoney(tournament.estimated_prize_total, tournament.currency)}
                  </Text>
                ) : null}
              </Card>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
