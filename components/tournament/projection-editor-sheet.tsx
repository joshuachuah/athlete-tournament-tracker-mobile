import { X } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import type { ProjectionEditor } from "@/components/tournament/impact-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, spacing } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  calculateAccommodationTotal,
  deriveDraftDates,
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { formatMoney, roundLabels } from "@/lib/utils";
import { zodErrorMap } from "@/lib/zod-errors";
import type { PrizeRounds, SubsidyCovers } from "@/types";

const rounds: Array<keyof PrizeRounds> = ["r1", "r2", "r3", "qf", "sf", "f", "w"];

const coverOptions: Array<{ value: SubsidyCovers; label: string }> = [
  { value: "flights", label: "Flights" },
  { value: "accommodation", label: "Accommodation" },
  { value: "full_expenses", label: "Full expenses" },
  { value: "flat_stipend", label: "Flat stipend" },
];

const editorTitles: Record<ProjectionEditor, { title: string; description: string }> = {
  details: {
    title: "Tournament details",
    description: "Set the identity, dates, currency, and entry fee.",
  },
  prize: {
    title: "Prize and tax",
    description: "Enter server-projected prize outcomes and withholding.",
  },
  travel: {
    title: "Travel and stay",
    description: "Add flights and calculate accommodation from nightly cost.",
  },
  "daily-spending": {
    title: "Daily spending cap",
    description: "Set a maximum day-to-day tournament spend.",
  },
  coaching: {
    title: "Coaching / physio",
    description: "Add tournament-specific athlete support costs.",
  },
  misc: {
    title: "Miscellaneous cost",
    description: "Add other costs already supported by the projection.",
  },
  sponsorship: {
    title: "Sponsorship",
    description: "Allocate existing sponsorship to this tournament.",
  },
  subsidy: {
    title: "Subsidy",
    description: "Describe financial support and what it covers.",
  },
};

function schemaForEditor(editor: ProjectionEditor) {
  if (editor === "details") return detailsSchema;
  if (editor === "prize") return prizesSchema;
  if (editor === "travel") return travelSchema;
  if (editor === "subsidy" || editor === "sponsorship") return subsidySchema;
  return spendingSchema;
}

export function ProjectionEditorSheet({
  draft,
  editor,
  onApply,
  onClose,
}: {
  draft: TournamentDraft;
  editor: ProjectionEditor;
  onApply: (draft: TournamentDraft) => void;
  onClose: () => void;
}) {
  const [workingDraft, setWorkingDraft] = useState(() => ({
    ...draft,
    prize_rounds: { ...draft.prize_rounds },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reducedMotion = useReducedMotion();
  const heading = editorTitles[editor];

  function update(changes: Partial<TournamentDraft>) {
    setWorkingDraft((current) => deriveDraftDates({ ...current, ...changes }));
  }

  function updateAccommodation(changes: {
    accommodation_nightly?: number;
    accommodation_nights?: number;
  }) {
    setWorkingDraft((current) => {
      const nightly = changes.accommodation_nightly ?? current.accommodation_nightly;
      const nights = changes.accommodation_nights ?? current.accommodation_nights;
      return {
        ...current,
        accommodation_nightly: nightly,
        accommodation_nights: nights,
        accommodation_total: calculateAccommodationTotal(nightly, nights, current.currency),
      };
    });
  }

  function apply() {
    const result = schemaForEditor(editor).safeParse(workingDraft);
    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    onApply(deriveDraftDates(workingDraft));
  }

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel={`Close ${heading.title} editor`}
          accessibilityRole="button"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(14, 16, 18, 0.34)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "88%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
              paddingBottom: spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "900" }}>
                {heading.title}
              </Text>
              <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                {heading.description}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Close ${heading.title} editor`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <X color={colors.foreground} size={24} />
            </Pressable>
          </View>

          <ScrollView
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl, paddingTop: spacing.sm }}
          >
            {editor === "details" ? (
              <>
                <Input
                  label="Tournament name"
                  value={workingDraft.name}
                  onChangeText={(name) => update({ name })}
                  error={errors.name}
                  autoFocus
                  autoCapitalize="words"
                />
                <Input
                  label="Location"
                  value={workingDraft.location}
                  onChangeText={(location) => update({ location })}
                  error={errors.location}
                  autoCapitalize="words"
                />
                <Input
                  label="Country"
                  value={workingDraft.country}
                  onChangeText={(country) => update({ country })}
                  error={errors.country}
                  autoCapitalize="words"
                />
                <Input
                  label="Currency"
                  value={workingDraft.currency}
                  maxLength={3}
                  autoCapitalize="characters"
                  onChangeText={(currency) => update({ currency: currency.toUpperCase() })}
                  error={errors.currency}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                  <Input
                    label="Start date"
                    value={workingDraft.start_date}
                    onChangeText={(start_date) => update({ start_date })}
                    error={errors.start_date}
                    placeholder="YYYY-MM-DD"
                    style={{ minWidth: 144 }}
                  />
                  <Input
                    label="End date"
                    value={workingDraft.end_date}
                    onChangeText={(end_date) => update({ end_date })}
                    error={errors.end_date}
                    placeholder="YYYY-MM-DD"
                    style={{ minWidth: 144 }}
                  />
                </View>
                <Text style={{ color: colors.mutedForeground }}>
                  Duration: {workingDraft.duration_days} day{workingDraft.duration_days === 1 ? "" : "s"}
                </Text>
                <MoneyInput
                  label={`Entry fee (${workingDraft.currency})`}
                  value={workingDraft.entry_fee}
                  onChangeValue={(entry_fee) => update({ entry_fee })}
                  error={errors.entry_fee}
                />
              </>
            ) : null}

            {editor === "prize" ? (
              <>
                <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                  Prize amounts remain in tournament currency. The server is the source of truth for tax-aware P&amp;L.
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                  {rounds.map((round, index) => (
                    <MoneyInput
                      key={round}
                      label={`${roundLabels[round]} (${workingDraft.currency})`}
                      value={workingDraft.prize_rounds[round]}
                      onChangeValue={(amount) =>
                        update({
                          prize_rounds: { ...workingDraft.prize_rounds, [round]: amount },
                        })
                      }
                      error={errors[`prize_rounds.${round}`]}
                      autoFocus={index === 0}
                      style={{ minWidth: 136, flexGrow: 1 }}
                    />
                  ))}
                </View>
                <MoneyInput
                  label="Prize tax withholding %"
                  value={workingDraft.prize_tax_rate}
                  onChangeValue={(prize_tax_rate) => update({ prize_tax_rate })}
                  error={errors.prize_tax_rate}
                />
              </>
            ) : null}

            {editor === "travel" ? (
              <>
                <MoneyInput
                  label={`Flights (${workingDraft.currency})`}
                  value={workingDraft.flight_cost}
                  onChangeValue={(flight_cost) => update({ flight_cost })}
                  error={errors.flight_cost}
                  autoFocus
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                  <MoneyInput
                    label={`Nightly (${workingDraft.currency})`}
                    value={workingDraft.accommodation_nightly}
                    onChangeValue={(value) => updateAccommodation({ accommodation_nightly: value })}
                    error={errors.accommodation_nightly}
                    style={{ minWidth: 144, flexGrow: 1 }}
                  />
                  <MoneyInput
                    label="Nights"
                    value={workingDraft.accommodation_nights}
                    onChangeValue={(value) => updateAccommodation({ accommodation_nights: value })}
                    error={errors.accommodation_nights}
                    style={{ minWidth: 144, flexGrow: 1 }}
                  />
                </View>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>
                  Stay total: {formatMoney(workingDraft.accommodation_total, workingDraft.currency)}
                </Text>
              </>
            ) : null}

            {editor === "daily-spending" ? (
              <MoneyInput
                label={`Daily spending cap (${workingDraft.currency})`}
                value={workingDraft.daily_spending_cap}
                onChangeValue={(daily_spending_cap) => update({ daily_spending_cap })}
                error={errors.daily_spending_cap}
                autoFocus
              />
            ) : null}

            {editor === "coaching" ? (
              <MoneyInput
                label={`Coaching / physio (${workingDraft.currency})`}
                value={workingDraft.coaching_cost}
                onChangeValue={(coaching_cost) => update({ coaching_cost })}
                error={errors.coaching_cost}
                autoFocus
              />
            ) : null}

            {editor === "misc" ? (
              <MoneyInput
                label={`Miscellaneous (${workingDraft.currency})`}
                value={workingDraft.misc_cost}
                onChangeValue={(misc_cost) => update({ misc_cost })}
                error={errors.misc_cost}
                autoFocus
              />
            ) : null}

            {editor === "sponsorship" ? (
              <MoneyInput
                label={`Sponsorship allocated (${workingDraft.currency})`}
                value={workingDraft.sponsorship_allocated}
                onChangeValue={(sponsorship_allocated) => update({ sponsorship_allocated })}
                error={errors.sponsorship_allocated}
                autoFocus
              />
            ) : null}

            {editor === "subsidy" ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>
                      Subsidy applies
                    </Text>
                    <Text style={{ color: colors.mutedForeground }}>
                      Turn off to remove it from the saved projection.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Subsidy applies"
                    value={workingDraft.subsidy_enabled}
                    onValueChange={(subsidy_enabled) => update({ subsidy_enabled })}
                  />
                </View>
                {workingDraft.subsidy_enabled ? (
                  <>
                    <Input
                      label="Subsidy by"
                      value={workingDraft.subsidy_by}
                      onChangeText={(subsidy_by) => update({ subsidy_by })}
                      error={errors.subsidy_by}
                      autoFocus
                    />
                    <MoneyInput
                      label={`Subsidy amount (${workingDraft.currency})`}
                      value={workingDraft.subsidy_amount}
                      onChangeValue={(subsidy_amount) => update({ subsidy_amount })}
                      error={errors.subsidy_amount}
                    />
                    <View style={{ gap: spacing.sm }}>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 12,
                          fontWeight: "800",
                          textTransform: "uppercase",
                        }}
                      >
                        Covers
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                        {coverOptions.map((option) => (
                          <Button
                            key={option.value}
                            label={option.label}
                            variant={
                              workingDraft.subsidy_covers === option.value
                                ? "primary"
                                : "secondary"
                            }
                            accessibilityState={{
                              selected: workingDraft.subsidy_covers === option.value,
                            }}
                            onPress={() => update({ subsidy_covers: option.value })}
                          />
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          <View
            style={{
              gap: spacing.sm,
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Button label={`Apply ${heading.title.toLowerCase()}`} onPress={apply} />
            <Button label="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
