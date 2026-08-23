import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Keyboard,
  Pressable,
  Text,
  View,
  type TextInput,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors, radii, spacing } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import {
  createDefaultTournamentDraft,
  tournamentDraftFromKnown,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { formatDate, parseDateOnly } from "@/lib/utils";
import type { KnownTournament } from "@/types";

type DiscoveryState =
  | { mode: "search" }
  | { mode: "confirm-known"; tournament: KnownTournament }
  | { mode: "manual"; name: string };

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

function validDate(date: string | undefined) {
  return date && parseDateOnly(date) ? formatDate(date) : null;
}

function resultDescription(tournament: KnownTournament) {
  const parts = [tournament.location, tournament.country].filter(Boolean);
  const startDate = validDate(tournament.start_date);
  const endDate = validDate(tournament.end_date);
  if (startDate && endDate) {
    parts.push(`${startDate} to ${endDate}`);
  } else if (startDate || endDate) {
    parts.push(startDate ?? endDate ?? "");
  }
  return parts.join(" · ") || "Details can be completed after selection";
}

function knownTournamentDetails(tournament: KnownTournament) {
  const details: Array<{ label: string; value: string }> = [];
  const location = [tournament.location, tournament.country].filter(Boolean).join(", ");
  const startDate = validDate(tournament.start_date);
  const endDate = validDate(tournament.end_date);
  const dates =
    startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate ?? endDate;
  const level = tournament.tour_level || tournament.tier;

  if (location) details.push({ label: "Location", value: location });
  if (dates) details.push({ label: "Dates", value: dates });
  if (level) details.push({ label: "Tour level", value: level });
  if (tournament.currency) {
    details.push({ label: "Currency", value: tournament.currency.toUpperCase() });
  }
  details.push({
    label: "Prize schedule",
    value:
      tournament.prize_rounds &&
      Object.values(tournament.prize_rounds).some((amount) => amount > 0)
        ? "Available"
        : "Not available",
  });
  return details;
}

export function TournamentIdentitySearch({
  draft,
  inputRef,
  onSelectDraft,
  sport,
}: {
  draft: TournamentDraft;
  inputRef: React.RefObject<TextInput | null>;
  onSelectDraft: (draft: TournamentDraft) => void;
  sport?: string;
}) {
  const [query, setQuery] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryState>({ mode: "search" });
  const [manualError, setManualError] = useState<string | null>(null);
  const manualInputRef = useRef<TextInput>(null);
  const confirmationStartedRef = useRef(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = discovery.mode === "search" && debouncedQuery.length >= 2;
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
    discovery.mode === "search" &&
    query.trim().length >= 2 &&
    query.trim() !== debouncedQuery;
  const showResults =
    discovery.mode === "search" &&
    canSearch &&
    query.trim() === debouncedQuery;

  function openManualEntry() {
    setManualError(null);
    setDiscovery({ mode: "manual", name: query.trim() });
    AccessibilityInfo.announceForAccessibility("Add manually");
  }

  function openKnownConfirmation(tournament: KnownTournament) {
    setDiscovery({ mode: "confirm-known", tournament });
    AccessibilityInfo.announceForAccessibility(
      `Confirm tournament. ${tournament.name}`,
    );
  }

  function confirmKnown(tournament: KnownTournament) {
    if (confirmationStartedRef.current) return;
    confirmationStartedRef.current = true;
    onSelectDraft(tournamentDraftFromKnown(tournament));
  }

  function confirmManual(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setManualError("Enter a tournament name.");
      AccessibilityInfo.announceForAccessibility("Enter a tournament name.");
      manualInputRef.current?.focus();
      return;
    }
    if (confirmationStartedRef.current) return;
    confirmationStartedRef.current = true;
    const baseDraft = draft.name.trim() ? createDefaultTournamentDraft() : draft;
    onSelectDraft({ ...baseDraft, name: trimmedName });
  }

  if (discovery.mode === "confirm-known") {
    const { tournament } = discovery;
    return (
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}
          >
            Confirm tournament
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            Check the event before building your projection.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>
            {tournament.name}
          </Text>
          {knownTournamentDetails(tournament).map((detail) => (
            <View key={detail.label} style={{ gap: 2 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {detail.label}
              </Text>
              <Text style={{ color: colors.foreground, lineHeight: 20 }}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button label="Build projection" onPress={() => confirmKnown(tournament)} />
          <Button
            label="Back to results"
            onPress={() => setDiscovery({ mode: "search" })}
            variant="ghost"
          />
        </View>
      </View>
    );
  }

  if (discovery.mode === "manual") {
    return (
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}
          >
            Add manually
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            Start with the tournament name. You can add its details next.
          </Text>
        </View>

        <Input
          inputRef={manualInputRef}
          label="Tournament name"
          value={discovery.name}
          error={manualError ?? undefined}
          onChangeText={(name) => {
            setManualError(null);
            setDiscovery({ mode: "manual", name });
          }}
          onSubmitEditing={() => confirmManual(discovery.name)}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
        />

        <View style={{ gap: spacing.sm }}>
          <Button
            label="Continue manually"
            onPress={() => confirmManual(discovery.name)}
          />
          <Button
            label="Back to search"
            onPress={() => {
              setManualError(null);
              setDiscovery({ mode: "search" });
            }}
            variant="ghost"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}
        >
          Which tournament?
        </Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
          Search for the event you want to project.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Input
          inputRef={inputRef}
          label="Tournament name"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          placeholder="Search by tournament name"
          leadingIcon={<Search color={colors.mutedForeground} size={20} />}
        />
        {sport ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            {sport.charAt(0).toUpperCase() + sport.slice(1)} narrows the results automatically.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={openManualEntry}
          style={({ pressed }) => ({
            minHeight: 44,
            alignSelf: "flex-start",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: colors.accent, fontWeight: "800" }}>
            I can't find my tournament
          </Text>
        </Pressable>
      </View>

      {waitingForDebounce || (showResults && isFetching && results === undefined) ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={{ color: colors.mutedForeground }}>Searching tournaments...</Text>
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

      {showResults && !isError && (!isFetching || results !== undefined) ? (
        <View style={{ gap: spacing.xl }}>
          <View accessibilityLabel="Known tournaments" style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>
              Known tournaments
            </Text>
            {results?.length ? (
              <View
                style={{
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  backgroundColor: colors.surface,
                }}
              >
                {results.map((tournament, index) => (
                  <View key={tournamentKey(tournament)}>
                    {index > 0 ? (
                      <View style={{ height: 1, backgroundColor: colors.border }} />
                    ) : null}
                    <Pressable
                      accessibilityLabel={`${tournament.name}. ${resultDescription(tournament)}`}
                      accessibilityRole="button"
                      onPress={() => openKnownConfirmation(tournament)}
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
              </View>
            ) : (
              <Text style={{ color: colors.mutedForeground }}>
                No known tournaments found.
              </Text>
            )}
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>
              Not listed?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={openManualEntry}
              style={({ pressed }) => ({
                minHeight: 44,
                alignSelf: "flex-start",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.accent, fontWeight: "800" }}>
                Enter tournament manually
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {query.trim().length === 1 ? (
        <Text style={{ color: colors.mutedForeground }}>
          Enter one more character to search.
        </Text>
      ) : null}
    </View>
  );
}
