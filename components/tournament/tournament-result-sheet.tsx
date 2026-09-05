import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { SheetGrabber } from "@/components/ui/sheet-grabber";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { prizeRoundKeys, type PrizeRoundKey } from "@/lib/prize-distributions";
import { queryClient } from "@/lib/query-client";
import { formatMoney, roundLabels } from "@/lib/utils";
import type { TournamentResultInput, TournamentWithPnL } from "@/types";

type ResultMutationVariables = {
  input: TournamentResultInput;
  profileId: string;
  tournamentId: string;
  userId: string;
};

type RemoveMutationVariables = Omit<ResultMutationVariables, "input">;

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
  },
  description: {
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionDescription: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  roundList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roundButton: {
    minHeight: 44,
    minWidth: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  roundButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  roundButtonIdle: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roundLabel: {
    color: colors.foreground,
    fontWeight: "700",
  },
  reviewToggle: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  reviewCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  preview: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  previewLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  previewAmount: {
    fontSize: 30,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  confirmation: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  confirmationBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.sm,
  },
  confirmationChecked: {
    backgroundColor: colors.accent,
  },
  footer: {
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});

function initialResult(tournament: TournamentWithPnL): TournamentResultInput {
  const projectedRound =
    tournament.pnl.scenarios.find((scenario) => scenario.scenario === "realistic")
      ?.round;
  const achievedRound =
    tournament.result?.achieved_round ??
    projectedRound ??
    prizeRoundKeys.find(
      (round) => tournament.prize_rounds[round] !== undefined,
    ) ??
    "r1";

  return {
    achieved_round: achievedRound,
    prize_received_total:
      tournament.result?.prize_received_total ??
      tournament.pnl.prize_rounds_after_estimated_withholding?.[
        achievedRound
      ] ??
      tournament.prize_rounds[achievedRound] ??
      0,
    subsidy_received_total:
      tournament.result?.subsidy_received_total ?? tournament.subsidy_amount,
    sponsorship_received_total:
      tournament.result?.sponsorship_received_total ??
      tournament.sponsorship_allocated,
    entry_fee_total:
      tournament.result?.entry_fee_total ?? tournament.entry_fee,
    flight_total: tournament.result?.flight_total ?? tournament.flight_cost,
    accommodation_total:
      tournament.result?.accommodation_total ?? tournament.accommodation_total,
    food_total: tournament.result?.food_total ?? tournament.food_total ?? 0,
    local_transport_total:
      tournament.result?.local_transport_total ??
      tournament.local_transport_total ??
      0,
    coaching_total:
      tournament.result?.coaching_total ?? tournament.coaching_cost,
    misc_total: tournament.result?.misc_total ?? tournament.misc_cost,
  };
}

function availableRounds(): PrizeRoundKey[] {
  return [...prizeRoundKeys];
}

export function TournamentResultSheet({
  authenticatedUserId,
  onClose,
  profileId,
  tournament,
}: {
  authenticatedUserId: string;
  onClose: () => void;
  profileId: string;
  tournament: TournamentWithPnL;
}) {
  const [input, setInput] = useState(() => initialResult(tournament));
  const [confirmed, setConfirmed] = useState(false);
  const [legacySpendingAccountedFor, setLegacySpendingAccountedFor] =
    useState(false);
  const [showReview, setShowReview] = useState(false);
  const { isCurrentUser } = useAuth();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const serializedInput = JSON.stringify(input);
  const debouncedResultInput = useDebouncedValue(input, 350);
  const debouncedSerializedInput = JSON.stringify(debouncedResultInput);
  const waitingForDebounce = serializedInput !== debouncedSerializedInput;
  const rounds = availableRounds();

  const {
    data: previewData,
    error: previewError,
    isError: previewIsError,
    isFetching: previewIsFetching,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: [
      "tournament-result-preview",
      authenticatedUserId,
      tournament.id,
      debouncedSerializedInput,
    ],
    queryFn: ({ signal }) =>
      api.tournaments.previewResult(
        tournament.id,
        debouncedResultInput,
        { signal, authenticatedUserId },
      ),
    enabled: !waitingForDebounce,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (variables: ResultMutationVariables) =>
      api.tournaments.upsertResult(variables.tournamentId, variables.input, {
        authenticatedUserId: variables.userId,
      }),
    onSuccess: (saved, variables) => {
      if (!isCurrentUser(variables.userId)) return;

      queryClient.setQueryData(
        ["tournament", variables.tournamentId],
        saved,
      );
      queryClient.invalidateQueries({
        queryKey: ["tournament", variables.tournamentId],
        exact: true,
      });
      queryClient.invalidateQueries({
        queryKey: ["tournaments", variables.profileId],
      });
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (variables: RemoveMutationVariables) =>
      api.tournaments.removeResult(variables.tournamentId, {
        authenticatedUserId: variables.userId,
      }),
    onSuccess: (saved, variables) => {
      if (!isCurrentUser(variables.userId)) return;

      queryClient.setQueryData(
        ["tournament", variables.tournamentId],
        saved,
      );
      queryClient.invalidateQueries({
        queryKey: ["tournament", variables.tournamentId],
        exact: true,
      });
      queryClient.invalidateQueries({
        queryKey: ["tournaments", variables.profileId],
      });
      onClose();
    },
  });

  function update(changes: Partial<TournamentResultInput>) {
    setConfirmed(false);
    setInput((current) => ({ ...current, ...changes }));
  }

  function selectRound(achievedRound: PrizeRoundKey) {
    update({
      achieved_round: achievedRound,
      prize_received_total: tournament.result
        ? input.prize_received_total
        : tournament.pnl.prize_rounds_after_estimated_withholding?.[
              achievedRound
            ] ??
            tournament.prize_rounds[achievedRound] ??
            0,
    });
  }

  function save() {
    if (
      !confirmed ||
      !previewData ||
      waitingForDebounce ||
      saveMutation.isPending ||
      removeMutation.isPending
    ) {
      return;
    }

    saveMutation.mutate({
      input,
      profileId,
      tournamentId: tournament.id,
      userId: authenticatedUserId,
    });
  }

  function confirmRemove() {
    if (saveMutation.isPending || removeMutation.isPending) return;

    Alert.alert(
      "Remove result",
      "This removes the confirmed result and returns the tournament to its original projection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (saveMutation.isPending || removeMutation.isPending) return;
            removeMutation.mutate({
              profileId,
              tournamentId: tournament.id,
              userId: authenticatedUserId,
            });
          },
        },
      ],
    );
  }

  const previewLoading = waitingForDebounce || previewIsFetching;
  const mutationPending = saveMutation.isPending || removeMutation.isPending;
  const legacyDailySpendingTotal =
    tournament.daily_spending_cap * tournament.duration_days;
  const legacySpendingReady =
    legacyDailySpendingTotal === 0 || legacySpendingAccountedFor;
  const resultError =
    saveMutation.isError &&
    saveMutation.variables &&
    isCurrentUser(saveMutation.variables.userId)
      ? saveMutation.error
      : removeMutation.isError &&
          removeMutation.variables &&
          isCurrentUser(removeMutation.variables.userId)
        ? removeMutation.error
        : null;

  return (
    // pageSheet lets iOS draw the card: rounded corners, dimmed parent,
    // swipe-down to dismiss. onDismiss keeps our state in sync when the user swipes.
    <Modal
      allowSwipeDismissal
      animationType={reducedMotion ? "none" : "slide"}
      onDismiss={onClose}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
      >
        <View accessibilityViewIsModal style={styles.sheet}>
          <SheetGrabber />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                {tournament.result ? "Edit result" : "Record result"}
              </Text>
              <Text style={styles.description}>
                Confirm what happened. Your original projection will stay unchanged.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close result editor"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <X color={colors.foreground} size={24} />
            </Pressable>
          </View>

          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.section}>
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.sectionTitle}>Round reached</Text>
                <Text style={styles.sectionDescription}>
                  Choose Champion if you won the tournament.
                </Text>
              </View>
              <View accessibilityRole="radiogroup" style={styles.roundList}>
                {rounds.map((round) => {
                  const selected = input.achieved_round === round;
                  return (
                    <Pressable
                      key={round}
                      accessibilityLabel={round === "w" ? "Champion" : roundLabels[round]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => selectRound(round)}
                      style={({ pressed }) => [
                        styles.roundButton,
                        selected
                          ? styles.roundButtonSelected
                          : styles.roundButtonIdle,
                        { opacity: pressed ? 0.65 : 1 },
                      ]}
                    >
                      {selected ? <Check color={colors.accent} size={16} /> : null}
                      <Text style={styles.roundLabel}>
                        {round === "w" ? "Champion" : roundLabels[round]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actual income and expenses</Text>
              <MoneyInput
                label={`Prize received (${tournament.currency})`}
                value={input.prize_received_total}
                onChangeValue={(prize_received_total) =>
                  update({ prize_received_total })
                }
              />
              <MoneyInput
                label={`Food total (${tournament.currency})`}
                value={input.food_total}
                onChangeValue={(food_total) => update({ food_total })}
              />
              <MoneyInput
                label={`Local transport total (${tournament.currency})`}
                value={input.local_transport_total}
                onChangeValue={(local_transport_total) =>
                  update({ local_transport_total })
                }
              />
              <MoneyInput
                label={`Accommodation total (${tournament.currency})`}
                value={input.accommodation_total}
                onChangeValue={(accommodation_total) =>
                  update({ accommodation_total })
                }
              />
            </View>

            <View style={styles.section}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showReview }}
                onPress={() => setShowReview((current) => !current)}
                style={styles.reviewToggle}
              >
                <View style={styles.reviewCopy}>
                  <Text style={{ color: colors.foreground, fontWeight: "800" }}>
                    Review other amounts
                  </Text>
                  <Text style={styles.sectionDescription}>
                    Entry, flights, coaching, misc, subsidy and sponsorship
                  </Text>
                </View>
                {showReview ? (
                  <ChevronUp color={colors.mutedForeground} size={20} />
                ) : (
                  <ChevronDown color={colors.mutedForeground} size={20} />
                )}
              </Pressable>

              {showReview ? (
                <View style={styles.section}>
                  <MoneyInput
                    label={`Entry fee (${tournament.currency})`}
                    value={input.entry_fee_total}
                    onChangeValue={(entry_fee_total) => update({ entry_fee_total })}
                  />
                  <MoneyInput
                    label={`Flights (${tournament.currency})`}
                    value={input.flight_total}
                    onChangeValue={(flight_total) => update({ flight_total })}
                  />
                  <MoneyInput
                    label={`Coaching / physio (${tournament.currency})`}
                    value={input.coaching_total}
                    onChangeValue={(coaching_total) => update({ coaching_total })}
                  />
                  <MoneyInput
                    label={`Miscellaneous (${tournament.currency})`}
                    value={input.misc_total}
                    onChangeValue={(misc_total) => update({ misc_total })}
                  />
                  <MoneyInput
                    label={`Subsidy received (${tournament.currency})`}
                    value={input.subsidy_received_total}
                    onChangeValue={(subsidy_received_total) =>
                      update({ subsidy_received_total })
                    }
                  />
                  <MoneyInput
                    label={`Sponsorship received (${tournament.currency})`}
                    value={input.sponsorship_received_total}
                    onChangeValue={(sponsorship_received_total) =>
                      update({ sponsorship_received_total })
                    }
                  />
                </View>
              ) : null}
            </View>

            {previewLoading ? <LoadingState label="Calculating final result" /> : null}
            {previewIsError && !previewLoading ? (
              <ErrorState
                textAlign="center"
                message={errorMessage(
                  previewError,
                  "Couldn't calculate the final result.",
                )}
                onRetry={() => refetchPreview()}
              />
            ) : null}
            {previewData && !previewLoading ? (
              <View
                accessible
                accessibilityLabel={`Result preview, ${previewData.net_result > 0 ? "profit" : previewData.net_result < 0 ? "loss" : "break-even"}, ${formatMoney(previewData.net_result, previewData.home_currency)}. Income ${formatMoney(previewData.total_income, previewData.home_currency)}. Expenses ${formatMoney(previewData.total_expenses, previewData.home_currency)}.`}
                style={styles.preview}
              >
                <Text style={styles.previewLabel}>Result preview</Text>
                <Text
                  style={[
                    styles.previewAmount,
                    {
                      color:
                        previewData.net_result > 0
                          ? colors.profit
                          : previewData.net_result < 0
                            ? colors.loss
                            : colors.foreground,
                    },
                  ]}
                  selectable
                >
                  {formatMoney(
                    previewData.net_result,
                    previewData.home_currency,
                  )}
                </Text>
                <Text style={styles.sectionDescription} selectable>
                  Income {formatMoney(previewData.total_income, previewData.home_currency)} · Expenses {formatMoney(previewData.total_expenses, previewData.home_currency)}
                </Text>
              </View>
            ) : null}

            {legacyDailySpendingTotal > 0 ? (
              <View style={styles.section}>
                <Text style={{ color: colors.warning, lineHeight: 20 }}>
                  This older projection includes {formatMoney(
                    legacyDailySpendingTotal,
                    tournament.currency,
                  )} of unsplit daily spending. Include the actual amount in Food,
                  Local transport, or Miscellaneous before confirming.
                </Text>
                <Pressable
                  accessibilityLabel="I accounted for the older daily spending"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: legacySpendingAccountedFor }}
                  onPress={() => {
                    setConfirmed(false);
                    setLegacySpendingAccountedFor((current) => !current);
                  }}
                  style={({ pressed }) => [
                    styles.confirmation,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.confirmationBox,
                      legacySpendingAccountedFor
                        ? styles.confirmationChecked
                        : null,
                    ]}
                  >
                    {legacySpendingAccountedFor ? (
                      <Check color={colors.brandForeground} size={16} />
                    ) : null}
                  </View>
                  <Text
                    style={{ flex: 1, color: colors.foreground, lineHeight: 20 }}
                  >
                    I accounted for the older daily spending.
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="I confirm these are the actual amounts"
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: confirmed,
                disabled: !legacySpendingReady,
              }}
              disabled={!legacySpendingReady}
              onPress={() => setConfirmed((current) => !current)}
              style={({ pressed }) => [
                styles.confirmation,
                { opacity: !legacySpendingReady ? 0.55 : pressed ? 0.65 : 1 },
              ]}
            >
              <View
                style={[
                  styles.confirmationBox,
                  confirmed ? styles.confirmationChecked : null,
                ]}
              >
                {confirmed ? <Check color={colors.brandForeground} size={16} /> : null}
              </View>
              <Text style={{ flex: 1, color: colors.foreground, lineHeight: 20 }}>
                I confirm these are the actual amounts.
              </Text>
            </Pressable>

            {resultError ? (
              <ErrorState
                message={errorMessage(resultError, "Couldn't update this result.")}
              />
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) },
            ]}
          >
            <Button
              label={tournament.result ? "Save result" : "Record result"}
              disabled={
                !confirmed ||
                !legacySpendingReady ||
                !previewData ||
                previewLoading ||
                mutationPending
              }
              loading={saveMutation.isPending}
              onPress={save}
            />
            {tournament.result ? (
              <Button
                label="Remove result"
                variant="danger"
                disabled={mutationPending}
                loading={removeMutation.isPending}
                onPress={confirmRemove}
              />
            ) : null}
            <Button label="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
