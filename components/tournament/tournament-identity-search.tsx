import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type TextInput } from "react-native";

import { Input } from "@/components/ui/input";
import { colors, radii, spacing } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import {
  tournamentDraftFromKnown,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { formatDate, parseDateOnly } from "@/lib/utils";
import type { KnownTournament } from "@/types";

function tournamentKey(tournament: KnownTournament): string {
  return (
    tournament.id ??
    JSON.stringify([
      tournament.name,
      tournament.location,
      tournament.country,
      tournament.start_date,
      tournament.end_date,
      tournament.tier,
      tournament.tour_level,
    ])
  );
}

function resultDescription(tournament: KnownTournament) {
  const parts = [tournament.location, tournament.country].filter(Boolean);
  if (tournament.start_date && parseDateOnly(tournament.start_date)) {
    parts.push(formatDate(tournament.start_date));
  }
  return parts.join(" · ") || "Details can be completed after selection";
}

export function TournamentIdentitySearch({
  draft,
  inputRef,
  onChangeDraft,
  onResolutionChange,
  sport,
}: {
  draft: TournamentDraft;
  inputRef: React.RefObject<TextInput | null>;
  onChangeDraft: (draft: TournamentDraft) => void;
  onResolutionChange: (resolved: boolean) => void;
  sport?: string;
}) {
  // The parent keys this search by the selected identity, so the editable query
  // deliberately captures its value once and resets on remount.
  const [query, setQuery] = useState(() => draft.name);
  const [committed, setCommitted] = useState(Boolean(draft.name.trim()));
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = !committed && debouncedQuery.length >= 2;
  const {
    data: results,
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["tournament-search", debouncedQuery, sport],
    queryFn: ({ signal }) => api.tournaments.search(debouncedQuery, sport, { signal }),
    enabled: canSearch,
  });
  const waitingForDebounce =
    !committed && query.trim().length >= 2 && query.trim() !== debouncedQuery;
  const showResults = canSearch && query.trim() === debouncedQuery;

  function chooseKnown(tournament: KnownTournament) {
    onChangeDraft(tournamentDraftFromKnown(tournament));
    setQuery(tournament.name);
    setCommitted(true);
    onResolutionChange(true);
  }

  function chooseNew() {
    const name = query.trim();
    if (!name) return;
    onChangeDraft({ ...draft, name });
    setQuery(name);
    setCommitted(true);
    onResolutionChange(true);
  }

  function changeSelection() {
    setCommitted(false);
    onResolutionChange(false);
    inputRef.current?.focus();
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          Add tournament
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}>
          Create a new projection
        </Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
          Search for a known event or enter a new tournament name.
        </Text>
      </View>

      <View style={{ position: "relative" }}>
        <Input
          inputRef={inputRef}
          label="Tournament name"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setCommitted(false);
            onResolutionChange(false);
          }}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (!results?.length && query.trim()) chooseNew();
          }}
          placeholder="Search or enter a tournament"
          style={{ paddingLeft: 44 }}
        />
        <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 39 }}>
          <Search color={colors.mutedForeground} size={20} />
        </View>
      </View>

      {committed && draft.name ? (
        <Pressable
          accessibilityHint="Returns focus to the tournament search field"
          accessibilityLabel={`Selected tournament ${draft.name}. Change selection`}
          accessibilityRole="button"
          onPress={changeSelection}
          style={({ pressed }) => ({
            minHeight: 60,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.accent,
            backgroundColor: colors.accentSoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 30,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 15,
              backgroundColor: colors.accent,
            }}
          >
            <Check color="#FFFFFF" size={18} strokeWidth={3} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>
              {draft.name}
            </Text>
            <Text style={{ color: colors.mutedForeground }}>
              {draft.location.trim() || "Complete tournament details"}
            </Text>
          </View>
          <Text style={{ color: colors.accent, fontWeight: "800" }}>Change</Text>
        </Pressable>
      ) : null}

      {waitingForDebounce || (showResults && isFetching) ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={{ color: colors.mutedForeground }}>Searching tournaments…</Text>
        </View>
      ) : null}

      {showResults && isError ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.lossSoft,
          }}
        >
          <Text style={{ color: colors.loss, lineHeight: 20 }}>
            {error.message || "Tournament search is unavailable."}
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => refetch()}
            style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
          >
            <Text style={{ color: colors.loss, fontWeight: "800" }}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {showResults && !isError && !isFetching ? (
        <View
          accessibilityLabel="Tournament search results"
          style={{
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
          }}
        >
          {results?.map((tournament, index) => (
            <View key={tournamentKey(tournament)}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <Pressable
                accessibilityLabel={`${tournament.name}. ${resultDescription(tournament)}`}
                accessibilityRole="button"
                onPress={() => chooseKnown(tournament)}
                style={({ pressed }) => ({
                  minHeight: 64,
                  gap: 3,
                  justifyContent: "center",
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                })}
              >
                <Text style={{ color: colors.foreground, fontWeight: "800" }}>
                  {tournament.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, lineHeight: 18 }}>
                  {resultDescription(tournament)}
                </Text>
              </Pressable>
            </View>
          ))}
          {results?.length ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
          <Pressable
            accessibilityLabel={`Create a new tournament named ${query.trim()}`}
            accessibilityRole="button"
            onPress={chooseNew}
            style={({ pressed }) => ({
              minHeight: 64,
              justifyContent: "center",
              paddingHorizontal: spacing.md,
              backgroundColor: pressed ? colors.accentSoft : colors.surface,
            })}
          >
            <Text style={{ color: colors.accent, fontWeight: "800" }}>
              Use “{query.trim()}” as a new tournament
            </Text>
            {results?.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, marginTop: 3 }}>
                No known tournaments matched this name.
              </Text>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {!committed && query.trim().length === 1 ? (
        <Text style={{ color: colors.mutedForeground }}>
          Enter one more character to search, or keep typing a new name.
        </Text>
      ) : null}
    </View>
  );
}
