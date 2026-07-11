import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, spacing } from "@/constants/theme";
import { useTournamentDraft } from "@/context/tournament-draft";
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

const rounds: (keyof PrizeRounds)[] = ["r1", "r2", "r3", "qf", "sf", "f", "w"];

const coverOptions: { value: SubsidyCovers; label: string }[] = [
  { value: "flights", label: "Flights" },
  { value: "accommodation", label: "Accommodation" },
  { value: "full_expenses", label: "Full expenses" },
  { value: "flat_stipend", label: "Flat stipend" },
];

export type TournamentFormSection = "prizes" | "travel" | "funding" | "spending";

const sectionSchemas = [
  ["details", detailsSchema],
  ["prizes", prizesSchema],
  ["travel", travelSchema],
  ["funding", subsidySchema],
  ["spending", spendingSchema],
] as const;

export function validateTournamentDraft(draft: TournamentDraft): {
  errors: Record<string, string>;
  firstInvalidSection?: TournamentFormSection;
} {
  let firstInvalidSection: TournamentFormSection | undefined;
  const errors = sectionSchemas.reduce<Record<string, string>>(
    (allErrors, [section, schema]) => {
      const result = schema.safeParse(draft);

      if (result.success) {
        return allErrors;
      }

      if (section !== "details" && !firstInvalidSection) {
        firstInvalidSection = section;
      }

      return { ...allErrors, ...zodErrorMap(result.error) };
    },
    {},
  );

  return { errors, firstInvalidSection };
}

function CollapsibleSection({
  expanded,
  onToggle,
  summary,
  title,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  summary: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "800" }}>
            {title}
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
            {summary}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp color={colors.mutedForeground} size={22} />
        ) : (
          <ChevronDown color={colors.mutedForeground} size={22} />
        )}
      </Pressable>
      {expanded ? <View style={{ gap: spacing.lg }}>{children}</View> : null}
    </Card>
  );
}

function prizeSummary(draft: TournamentDraft) {
  const total = rounds.reduce((sum, round) => sum + draft.prize_rounds[round], 0);

  if (total === 0 && draft.prize_tax_rate === 0) {
    return "No prize estimates added";
  }

  const tax = draft.prize_tax_rate > 0 ? ` · ${draft.prize_tax_rate}% tax` : "";
  return `${formatMoney(total, draft.currency)} across rounds${tax}`;
}

function travelSummary(draft: TournamentDraft) {
  const total = draft.flight_cost + draft.accommodation_total;
  return total > 0
    ? `${formatMoney(total, draft.currency)} planned`
    : "No travel costs added";
}

function fundingSummary(draft: TournamentDraft) {
  const subsidy = draft.subsidy_enabled ? draft.subsidy_amount : 0;
  const total = subsidy + draft.sponsorship_allocated;
  return total > 0
    ? `${formatMoney(total, draft.currency)} allocated`
    : "No funding added";
}

function spendingSummary(draft: TournamentDraft) {
  const extras = draft.coaching_cost + draft.misc_cost;

  if (extras === 0 && draft.daily_spending_cap === 0) {
    return "No spending plan added";
  }

  const cap =
    draft.daily_spending_cap > 0
      ? ` · ${formatMoney(draft.daily_spending_cap, draft.currency)} daily cap`
      : "";
  return `${formatMoney(extras, draft.currency)} extras${cap}`;
}

export function TournamentForm({
  initialDraft,
  loading = false,
  onSubmit,
  submitError,
}: {
  initialDraft: TournamentDraft;
  loading?: boolean;
  onSubmit: (draft: TournamentDraft) => void;
  submitError?: string | null;
}) {
  const { setDraft } = useTournamentDraft();
  const [formDraft, setFormDraft] = useState(() => initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionSummary, setSubmissionSummary] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<TournamentFormSection, boolean>
  >({
    prizes: false,
    travel: false,
    funding: false,
    spending: false,
  });

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft.editId]);

  function updateFormDraft(changes: Partial<TournamentDraft>) {
    const next = deriveDraftDates({ ...formDraft, ...changes });
    setFormDraft(next);
    setDraft(next);
  }

  function updateAccommodation(changes: {
    accommodation_nightly?: number;
    accommodation_nights?: number;
  }) {
    const accommodation_nightly =
      changes.accommodation_nightly ?? formDraft.accommodation_nightly;
    const accommodation_nights =
      changes.accommodation_nights ?? formDraft.accommodation_nights;

    updateFormDraft({
      accommodation_nightly,
      accommodation_nights,
      accommodation_total: calculateAccommodationTotal(
        accommodation_nightly,
        accommodation_nights,
        formDraft.currency,
      ),
    });
  }

  function toggleSection(section: TournamentFormSection) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function handleSubmit() {
    const validation = validateTournamentDraft(formDraft);
    setErrors(validation.errors);

    if (Object.keys(validation.errors).length > 0) {
      if (validation.firstInvalidSection) {
        setExpandedSections((current) => ({
          ...current,
          [validation.firstInvalidSection as TournamentFormSection]: true,
        }));
      }
      const count = Object.keys(validation.errors).length;
      setSubmissionSummary(
        `Review ${count} highlighted field${count === 1 ? "" : "s"} before saving.`,
      );
      return;
    }

    setSubmissionSummary(null);
    onSubmit(formDraft);
  }

  const plannedExtrasPerDay =
    formDraft.duration_days > 0
      ? (formDraft.coaching_cost + formDraft.misc_cost) / formDraft.duration_days
      : 0;
  const overCap =
    formDraft.daily_spending_cap > 0 &&
    plannedExtrasPerDay > formDraft.daily_spending_cap;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}>
            {formDraft.editId ? "Edit tournament" : "Tournament projection"}
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
            Add the essentials, then open only the financial sections you need.
          </Text>
        </View>

        <Card>
          <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "800" }}>
            Tournament details
          </Text>
          <Input
            label="Tournament name"
            value={formDraft.name}
            onChangeText={(name) => updateFormDraft({ name })}
            error={errors.name}
          />
          <Input
            label="Location"
            value={formDraft.location}
            onChangeText={(location) => updateFormDraft({ location })}
            error={errors.location}
          />
          <Input
            label="Country"
            value={formDraft.country}
            onChangeText={(country) => updateFormDraft({ country })}
            error={errors.country}
          />
          <Input
            label="Currency"
            value={formDraft.currency}
            maxLength={3}
            autoCapitalize="characters"
            onChangeText={(currency) =>
              updateFormDraft({ currency: currency.toUpperCase() })
            }
            error={errors.currency}
          />
          <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
            <Input
              label="Start date"
              value={formDraft.start_date}
              onChangeText={(start_date) => updateFormDraft({ start_date })}
              error={errors.start_date}
              style={{ minWidth: 150 }}
            />
            <Input
              label="End date"
              value={formDraft.end_date}
              onChangeText={(end_date) => updateFormDraft({ end_date })}
              error={errors.end_date}
              style={{ minWidth: 150 }}
            />
          </View>
          <Text style={{ color: colors.mutedForeground }} selectable>
            Duration: {formDraft.duration_days} day
            {formDraft.duration_days === 1 ? "" : "s"}
          </Text>
          <MoneyInput
            label={`Entry fee (${formDraft.currency})`}
            value={formDraft.entry_fee}
            onChangeValue={(entry_fee) => updateFormDraft({ entry_fee })}
            error={errors.entry_fee}
          />
        </Card>

        <CollapsibleSection
          title="Prize and tax"
          summary={prizeSummary(formDraft)}
          expanded={expandedSections.prizes}
          onToggle={() => toggleSection("prizes")}
        >
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
            Prize amounts stay in tournament currency. The server converts and
            calculates P&amp;L in your home currency.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {rounds.map((round) => (
              <MoneyInput
                key={round}
                label={`${roundLabels[round]} (${formDraft.currency})`}
                value={formDraft.prize_rounds[round]}
                onChangeValue={(amount) =>
                  updateFormDraft({
                    prize_rounds: { ...formDraft.prize_rounds, [round]: amount },
                  })
                }
                error={errors[`prize_rounds.${round}`]}
                style={{ minWidth: 135 }}
              />
            ))}
          </View>
          <MoneyInput
            label="Prize tax withholding %"
            value={formDraft.prize_tax_rate}
            onChangeValue={(prize_tax_rate) => updateFormDraft({ prize_tax_rate })}
            error={errors.prize_tax_rate}
            style={{ maxWidth: 220 }}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Travel"
          summary={travelSummary(formDraft)}
          expanded={expandedSections.travel}
          onToggle={() => toggleSection("travel")}
        >
          <MoneyInput
            label={`Flights (${formDraft.currency})`}
            value={formDraft.flight_cost}
            onChangeValue={(flight_cost) => updateFormDraft({ flight_cost })}
            error={errors.flight_cost}
          />
          <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
            <MoneyInput
              label={`Nightly (${formDraft.currency})`}
              value={formDraft.accommodation_nightly}
              onChangeValue={(value) =>
                updateAccommodation({ accommodation_nightly: value })
              }
              error={errors.accommodation_nightly}
              style={{ minWidth: 145 }}
            />
            <MoneyInput
              label="Nights"
              value={formDraft.accommodation_nights}
              onChangeValue={(value) => updateAccommodation({ accommodation_nights: value })}
              error={errors.accommodation_nights}
              style={{ minWidth: 145 }}
            />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }} selectable>
            Accommodation total: {formatMoney(formDraft.accommodation_total, formDraft.currency)}
          </Text>
        </CollapsibleSection>

        <CollapsibleSection
          title="Funding"
          summary={fundingSummary(formDraft)}
          expanded={expandedSections.funding}
          onToggle={() => toggleSection("funding")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>
                I am subsidized
              </Text>
              <Text style={{ color: colors.mutedForeground }} selectable>
                Show subsidy fields only when they apply.
              </Text>
            </View>
            <Switch
              value={formDraft.subsidy_enabled}
              onValueChange={(subsidy_enabled) => updateFormDraft({ subsidy_enabled })}
            />
          </View>
          {formDraft.subsidy_enabled ? (
            <>
              <Input
                label="Subsidy by"
                value={formDraft.subsidy_by}
                onChangeText={(subsidy_by) => updateFormDraft({ subsidy_by })}
                error={errors.subsidy_by}
              />
              <MoneyInput
                label={`Subsidy amount (${formDraft.currency})`}
                value={formDraft.subsidy_amount}
                onChangeValue={(subsidy_amount) => updateFormDraft({ subsidy_amount })}
                error={errors.subsidy_amount}
              />
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>
                  Covers
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {coverOptions.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      variant={formDraft.subsidy_covers === option.value ? "primary" : "secondary"}
                      onPress={() => updateFormDraft({ subsidy_covers: option.value })}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}
          <MoneyInput
            label={`Sponsorship allocated (${formDraft.currency})`}
            value={formDraft.sponsorship_allocated}
            onChangeValue={(sponsorship_allocated) =>
              updateFormDraft({ sponsorship_allocated })
            }
            error={errors.sponsorship_allocated}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Spending"
          summary={spendingSummary(formDraft)}
          expanded={expandedSections.spending}
          onToggle={() => toggleSection("spending")}
        >
          <MoneyInput
            label={`Daily spending cap (${formDraft.currency})`}
            value={formDraft.daily_spending_cap}
            onChangeValue={(daily_spending_cap) => updateFormDraft({ daily_spending_cap })}
            error={errors.daily_spending_cap}
          />
          <MoneyInput
            label={`Coaching / physio (${formDraft.currency})`}
            value={formDraft.coaching_cost}
            onChangeValue={(coaching_cost) => updateFormDraft({ coaching_cost })}
            error={errors.coaching_cost}
          />
          <MoneyInput
            label={`Misc (${formDraft.currency})`}
            value={formDraft.misc_cost}
            onChangeValue={(misc_cost) => updateFormDraft({ misc_cost })}
            error={errors.misc_cost}
          />
          {overCap ? (
            <Text style={{ color: colors.warning, backgroundColor: colors.warningSoft, padding: spacing.md, lineHeight: 20 }} selectable>
              Planned extras average {formatMoney(plannedExtrasPerDay, formDraft.currency)} per day, above the cap.
            </Text>
          ) : null}
        </CollapsibleSection>

      </ScrollView>

      <View
        style={{
          padding: spacing.lg,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {submissionSummary ? (
          <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
            {submissionSummary}
          </Text>
        ) : null}
        {submitError ? (
          <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
            {submitError}
          </Text>
        ) : null}
        <Button
          label={formDraft.editId ? "Save changes" : "Create projection"}
          loading={loading}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}
