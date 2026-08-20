import { Switch, Text, View } from "react-native";

import type { ProjectionEditor } from "@/components/tournament/impact-ledger";
import { PrizeDistributionSelector } from "@/components/tournament/prize-distribution-selector";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, spacing } from "@/constants/theme";
import type { TournamentDraft } from "@/lib/tournament-draft";
import { getDrawTemplate, prizeRoundKeys } from "@/lib/prize-distributions";
import { formatMoney, roundLabels } from "@/lib/utils";
import type { SubsidyCovers } from "@/types";

const coverOptions: Array<{ value: SubsidyCovers; label: string }> = [
  { value: "flights", label: "Flights" },
  { value: "accommodation", label: "Accommodation" },
  { value: "full_expenses", label: "Full expenses" },
  { value: "flat_stipend", label: "Flat stipend" },
];

/**
 * PSA choices own payout generation, so round amounts are deliberately
 * presentation-only. Saved tournaments without selector metadata use the same
 * rows and keep their existing payout snapshot until a PSA choice changes.
 */
function PrizeRoundRow({
  currency,
  label,
  players,
  value,
}: {
  currency: string;
  label: string;
  players?: number;
  value: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label} payout, ${formatMoney(value, currency)}`}
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.foreground, fontWeight: "800" }}>
          {label}
        </Text>
        {players !== undefined ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {players} player{players === 1 ? "" : "s"} paid
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.foreground, fontWeight: "800" }}>
        {formatMoney(value, currency)}
      </Text>
    </View>
  );
}

export function ProjectionEditorFields({
  editor,
  errors,
  onUpdate,
  onUpdateAccommodation,
  workingDraft,
}: {
  editor: ProjectionEditor;
  errors: Record<string, string>;
  onUpdate: (changes: Partial<TournamentDraft>) => void;
  onUpdateAccommodation: (changes: {
    accommodation_nightly?: number;
    accommodation_nights?: number;
  }) => void;
  workingDraft: TournamentDraft;
}) {
  if (editor === "details") {
    return (
      <>
        <Input
          label="Tournament name"
          value={workingDraft.name}
          onChangeText={(name) => onUpdate({ name })}
          error={errors.name}
          autoFocus
          autoCapitalize="words"
        />
        <Input
          label="Location"
          value={workingDraft.location}
          onChangeText={(location) => onUpdate({ location })}
          error={errors.location}
          autoCapitalize="words"
        />
        <Input
          label="Country"
          value={workingDraft.country}
          onChangeText={(country) => onUpdate({ country })}
          error={errors.country}
          autoCapitalize="words"
        />
        <Input
          label="Currency"
          value={workingDraft.currency}
          maxLength={3}
          autoCapitalize="characters"
          onChangeText={(currency) => onUpdate({ currency: currency.toUpperCase() })}
          error={errors.currency}
        />
        <DateRangePicker
          startDate={workingDraft.start_date}
          endDate={workingDraft.end_date}
          startError={errors.start_date}
          endError={errors.end_date}
          onChange={({ startDate, endDate }) =>
            onUpdate({ start_date: startDate, end_date: endDate })
          }
        />
        <Text style={{ color: colors.mutedForeground }}>
          Duration: {workingDraft.duration_days} day
          {workingDraft.duration_days === 1 ? "" : "s"}
        </Text>
        <MoneyInput
          label={`Entry fee (${workingDraft.currency})`}
          value={workingDraft.entry_fee}
          onChangeValue={(entry_fee) => onUpdate({ entry_fee })}
          error={errors.entry_fee}
        />
      </>
    );
  }

  if (editor === "prize") {
    const selectedTemplate = workingDraft.prize_draw_template_id
      ? getDrawTemplate(workingDraft.prize_draw_template_id)
      : null;
    const rounds = prizeRoundKeys.filter(
      (round) =>
        workingDraft.prize_rounds[round] > 0 &&
        (!selectedTemplate || selectedTemplate.percentages[round] !== undefined),
    );
    const generated =
      workingDraft.prize_distribution_mode === "generated" &&
      selectedTemplate !== null;

    return (
      <>
        <PrizeDistributionSelector draft={workingDraft} onUpdate={onUpdate} />
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Text
              style={{
                color: colors.accent,
                fontSize: 12,
                fontWeight: "800",
                textTransform: "uppercase",
              }}
            >
              {generated ? "PSA generated" : "Saved payout schedule"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {workingDraft.currency}
            </Text>
          </View>
          {rounds.length > 0 && workingDraft.prize_player_total > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Total player prize
              </Text>
              <Text
                style={{ color: colors.foreground, fontSize: 28, fontWeight: "900" }}
              >
                {formatMoney(
                  workingDraft.prize_player_total,
                  workingDraft.currency,
                )}
              </Text>
            </View>
          ) : null}
          {rounds.length > 0 ? (
            <View>
              {rounds.map((round) => (
                <PrizeRoundRow
                  key={round}
                  label={roundLabels[round]}
                  currency={workingDraft.currency}
                  players={selectedTemplate?.players[round]}
                  value={workingDraft.prize_rounds[round]}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
              Choose a supported PSA tier and draw to generate the payout schedule.
            </Text>
          )}
        </View>
        <View
          style={{
            gap: spacing.xs,
            paddingLeft: spacing.md,
            borderLeftWidth: 3,
            borderLeftColor:
              workingDraft.prize_tax_rate > 0 ? colors.accent : colors.warning,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "800",
            }}
          >
            {workingDraft.prize_tax_rate > 0
              ? "Withholding included"
              : "Gross prize projection"}
          </Text>
          <Text
            style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}
          >
            {workingDraft.prize_tax_rate > 0
              ? `The server will apply the ${workingDraft.prize_tax_rate}% rate supplied with this tournament.`
              : "Withholding is not included because no verified rate is available."}
          </Text>
          {errors.prize_tax_rate ? (
            <Text style={{ color: colors.loss, fontSize: 12 }}>
              {errors.prize_tax_rate}
            </Text>
          ) : null}
        </View>
      </>
    );
  }

  if (editor === "travel") {
    return (
      <>
        <MoneyInput
          label={`Flights (${workingDraft.currency})`}
          value={workingDraft.flight_cost}
          onChangeValue={(flight_cost) => onUpdate({ flight_cost })}
          error={errors.flight_cost}
          autoFocus
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <MoneyInput
            label={`Nightly (${workingDraft.currency})`}
            value={workingDraft.accommodation_nightly}
            onChangeValue={(value) =>
              onUpdateAccommodation({ accommodation_nightly: value })
            }
            error={errors.accommodation_nightly}
            style={{ minWidth: 144, flexGrow: 1 }}
          />
          <MoneyInput
            label="Nights"
            value={workingDraft.accommodation_nights}
            onChangeValue={(value) =>
              onUpdateAccommodation({ accommodation_nights: value })
            }
            error={errors.accommodation_nights}
            style={{ minWidth: 144, flexGrow: 1 }}
          />
        </View>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>
          Stay total:{" "}
          {formatMoney(workingDraft.accommodation_total, workingDraft.currency)}
        </Text>
      </>
    );
  }

  if (editor === "daily-spending") {
    return (
      <MoneyInput
        label={`Daily spending cap (${workingDraft.currency})`}
        value={workingDraft.daily_spending_cap}
        onChangeValue={(daily_spending_cap) => onUpdate({ daily_spending_cap })}
        error={errors.daily_spending_cap}
        autoFocus
      />
    );
  }

  if (editor === "coaching") {
    return (
      <MoneyInput
        label={`Coaching / physio (${workingDraft.currency})`}
        value={workingDraft.coaching_cost}
        onChangeValue={(coaching_cost) => onUpdate({ coaching_cost })}
        error={errors.coaching_cost}
        autoFocus
      />
    );
  }

  if (editor === "misc") {
    return (
      <MoneyInput
        label={`Miscellaneous (${workingDraft.currency})`}
        value={workingDraft.misc_cost}
        onChangeValue={(misc_cost) => onUpdate({ misc_cost })}
        error={errors.misc_cost}
        autoFocus
      />
    );
  }

  if (editor === "sponsorship") {
    return (
      <MoneyInput
        label={`Sponsorship allocated (${workingDraft.currency})`}
        value={workingDraft.sponsorship_allocated}
        onChangeValue={(sponsorship_allocated) => onUpdate({ sponsorship_allocated })}
        error={errors.sponsorship_allocated}
        autoFocus
      />
    );
  }

  return (
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
          onValueChange={(subsidy_enabled) => onUpdate({ subsidy_enabled })}
        />
      </View>
      {workingDraft.subsidy_enabled ? (
        <>
          <Input
            label="Subsidy by"
            value={workingDraft.subsidy_by}
            onChangeText={(subsidy_by) => onUpdate({ subsidy_by })}
            error={errors.subsidy_by}
            autoFocus
          />
          <MoneyInput
            label={`Subsidy amount (${workingDraft.currency})`}
            value={workingDraft.subsidy_amount}
            onChangeValue={(subsidy_amount) => onUpdate({ subsidy_amount })}
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
                  onPress={() => onUpdate({ subsidy_covers: option.value })}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}
