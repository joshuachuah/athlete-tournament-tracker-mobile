import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";
import {
  drawTemplates,
  generatePrizeRounds,
  getDrawTemplate,
  getPrizeTier,
  isPrizeTierId,
  prizeDistributionCurrency,
  prizeDistributionRevision,
  prizeRoundKeys,
  prizeTiers,
  type DrawTemplateId,
  type PrizeTier,
  type PrizeTierCategory,
  type PrizeTierId,
} from "@/lib/prize-distributions";
import type { TournamentDraft } from "@/lib/tournament-draft";
import { formatMoney } from "@/lib/utils";

const challengerLevels = [3, 6, 9, 12, 15] as const;
const stayOptions = [
  { suffix: "none", label: "None" },
  { suffix: "billeting", label: "Billeting" },
  { suffix: "hotel", label: "Hotel" },
] as const;

function challengerTierId(
  level: number,
  staySuffix: string,
): PrizeTierId | null {
  const id = `challenger_${level}_${staySuffix}`;
  return isPrizeTierId(id) ? id : null;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  helper: {
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  choice: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    borderCurve: "continuous",
  },
  choiceText: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceLabel: {
    color: colors.foreground,
    fontWeight: "800",
  },
  choiceDetail: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: colors.brand,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroLabel: {
    color: colors.brandMutedForeground,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  heroSegment: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  heroPill: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.brandBorder,
  },
  heroPillLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroTotal: {
    color: colors.brandForeground,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroTotalCurrency: {
    color: colors.brandMutedForeground,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  drawChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
    borderCurve: "continuous",
  },
  drawChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  notice: {
    gap: spacing.xs,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderRadius: radii.sm,
  },
  noticeTitle: {
    color: colors.foreground,
    fontWeight: "800",
  },
  noticeText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
});

function ChoiceRow({
  detail,
  disabled = false,
  label,
  onPress,
  selected,
}: {
  detail: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceDetail}>{detail}</Text>
      </View>
      {selected ? <Check color={colors.accent} size={20} /> : null}
    </Pressable>
  );
}

function HeroPill({
  disabled = false,
  label,
  onPress,
  selected,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.heroPill,
        {
          backgroundColor: selected ? colors.surface : colors.transparent,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.heroPillLabel,
          { color: selected ? colors.brand : colors.brandMutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function emptyPrizeRounds(): TournamentDraft["prize_rounds"] {
  return { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 };
}

export function PrizeDistributionSelector({
  draft,
  onUpdate,
}: {
  draft: TournamentDraft;
  onUpdate: (changes: Partial<TournamentDraft>) => void;
}) {
  const selectedTier = draft.prize_tier_id
    ? getPrizeTier(draft.prize_tier_id)
    : null;
  const [category, setCategory] = useState<PrizeTierCategory>(
    selectedTier?.category ?? "world",
  );
  const activeTier = selectedTier?.category === category ? selectedTier : null;
  const selectedTemplate = draft.prize_draw_template_id
    ? getDrawTemplate(draft.prize_draw_template_id)
    : null;
  const currencyMatches =
    draft.currency.toUpperCase() === prizeDistributionCurrency;

  // Challenger tier ids follow challenger_<level>_<stay>, so the selected
  // level/stay pair can be read straight off the id.
  const [, activeLevel, activeStay] =
    activeTier?.category === "challenger" ? activeTier.id.split("_") : [];

  // Payouts fill as soon as a tier and draw are both known; there is no
  // separate "generate" step. Falls back to zeros when generation is blocked
  // (manual-only tier, missing draw, or non-USD currency).
  function roundsFor(
    tier: PrizeTier,
    templateId: DrawTemplateId | null,
  ): TournamentDraft["prize_rounds"] {
    if (tier.manualOnly || !templateId || !currencyMatches) {
      return emptyPrizeRounds();
    }

    return {
      ...emptyPrizeRounds(),
      ...generatePrizeRounds(
        tier.playerPrizeMoney,
        templateId,
        prizeDistributionCurrency,
      ),
    };
  }

  function selectTier(tierId: PrizeTierId) {
    const tier = getPrizeTier(tierId);
    const templateId =
      tier.category === "world"
        ? tier.drawTemplateId
        : draft.prize_draw_template_id;

    onUpdate({
      prize_tier_id: tierId,
      prize_player_total: tier.playerPrizeMoney,
      prize_draw_template_id: templateId,
      prize_rounds: roundsFor(tier, templateId),
    });
  }

  function selectTemplate(templateId: DrawTemplateId) {
    onUpdate({
      ...(selectedTier?.category === "world"
        ? { prize_tier_id: null, prize_player_total: 0 }
        : {}),
      prize_draw_template_id: templateId,
      prize_rounds: activeTier
        ? roundsFor(activeTier, templateId)
        : emptyPrizeRounds(),
    });
  }

  if (draft.prize_distribution_mode === "manual") {
    return (
      <View style={styles.section}>
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.sectionHeading}>Manual payouts</Text>
          <Text style={styles.helper}>
            Enter any confirmed payout. Existing generated amounts stay editable.
          </Text>
        </View>
        <Button
          label="Use PSA selector"
          variant="secondary"
          onPress={() => {
            if (!selectedTemplate) {
              onUpdate({ prize_distribution_mode: "generated" });
              return;
            }

            const supportedRounds = emptyPrizeRounds();
            for (const round of prizeRoundKeys) {
              if (selectedTemplate.percentages[round] !== undefined) {
                supportedRounds[round] = draft.prize_rounds[round];
              }
            }

            onUpdate({
              prize_distribution_mode: "generated",
              prize_rounds: supportedRounds,
            });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.sectionHeading}>PSA payout selector</Text>
        <Text style={styles.helper}>
          Pick the official tier. Round payouts fill in as you choose.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button
          accessibilityState={{ selected: category === "world" }}
          label="World Event"
          onPress={() => setCategory("world")}
          style={{ flex: 1 }}
          variant={category === "world" ? "primary" : "secondary"}
        />
        <Button
          accessibilityState={{ selected: category === "challenger" }}
          label="Challenger"
          onPress={() => setCategory("challenger")}
          style={{ flex: 1 }}
          variant={category === "challenger" ? "primary" : "secondary"}
        />
      </View>

      {category === "world" ? (
        <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
          {prizeTiers
            .filter((tier) => tier.category === "world")
            .map((tier) => {
              const manualOnly = "manualOnly" in tier && tier.manualOnly;

              return (
                <ChoiceRow
                  key={tier.id}
                  label={tier.label}
                  detail={
                    manualOnly
                      ? "Manual only · group format"
                      : formatMoney(tier.playerPrizeMoney, prizeDistributionCurrency)
                  }
                  disabled={manualOnly}
                  selected={draft.prize_tier_id === tier.id}
                  onPress={() => selectTier(tier.id)}
                />
              );
            })}
        </View>
      ) : (
        <View style={styles.heroCard}>
          <Text style={[styles.heroLabel, { marginTop: 0 }]}>
            Challenger level
          </Text>
          <View accessibilityRole="radiogroup" style={styles.heroSegment}>
            {challengerLevels.map((level) => (
              <HeroPill
                key={level}
                label={`${level}K`}
                selected={activeLevel === String(level)}
                onPress={() => {
                  // Keep the current stay when the new level offers it;
                  // Challenger 3 only exists without accommodation.
                  const tierId =
                    challengerTierId(level, activeStay ?? "none") ??
                    challengerTierId(level, "none");

                  if (tierId) {
                    selectTier(tierId);
                  }
                }}
              />
            ))}
          </View>
          <Text style={styles.heroLabel}>Accommodation</Text>
          <View accessibilityRole="radiogroup" style={styles.heroSegment}>
            {stayOptions.map((stay) => {
              const tierId = activeLevel
                ? challengerTierId(Number(activeLevel), stay.suffix)
                : null;

              return (
                <HeroPill
                  key={stay.suffix}
                  label={stay.label}
                  disabled={tierId === null}
                  selected={activeStay === stay.suffix}
                  onPress={() => {
                    if (tierId) {
                      selectTier(tierId);
                    }
                  }}
                />
              );
            })}
          </View>
          <Text style={styles.heroLabel}>Total player prize</Text>
          <Text style={styles.heroTotal}>
            {activeTier ? (
              <>
                {formatMoney(activeTier.playerPrizeMoney, prizeDistributionCurrency)
                  .replace(` ${prizeDistributionCurrency}`, "")}{" "}
                <Text style={styles.heroTotalCurrency}>
                  {prizeDistributionCurrency}
                </Text>
              </>
            ) : (
              <Text style={styles.heroTotalCurrency}>Pick a level</Text>
            )}
          </Text>
        </View>
      )}

      {category === "challenger" ? (
        <View style={styles.section}>
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.sectionHeading}>Draw</Text>
            <Text style={styles.helper}>
              Challenger draw sizes are not fixed by the tier table.
            </Text>
          </View>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {drawTemplates.map((template) => {
              const selected = draft.prize_draw_template_id === template.id;

              return (
                <Pressable
                  key={template.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => selectTemplate(template.id)}
                  style={({ pressed }) => [
                    styles.drawChip,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected
                        ? colors.accentSoft
                        : colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.drawChipLabel,
                      {
                        color: selected ? colors.accent : colors.foreground,
                      },
                    ]}
                  >
                    {template.label}
                    {template.requiresByeConfirmation ? " ⚠︎" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeTier?.category === "world" && selectedTemplate ? (
        <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
          <Text style={styles.noticeTitle}>Draw set by tier</Text>
          <Text style={styles.noticeText}>{selectedTemplate.label}</Text>
        </View>
      ) : null}

      {activeTier && selectedTemplate?.requiresByeConfirmation ? (
        <View style={[styles.notice, { backgroundColor: colors.warningSoft }]}>
          <Text style={styles.noticeTitle}>Confirm bye adjustments</Text>
          <Text style={styles.noticeText}>
            This draw includes byes. Check the tournament&apos;s written PSA payout
            instructions and edit any amount that differs.
          </Text>
        </View>
      ) : null}

      {!currencyMatches ? (
        <View style={[styles.notice, { backgroundColor: colors.lossSoft }]}>
          <Text style={styles.noticeTitle}>USD required for official tiers</Text>
          <Text style={styles.noticeText}>
            PSA publishes these tier amounts in USD. Change the tournament currency to USD or
            enter payouts manually so amounts are not mislabeled.
          </Text>
        </View>
      ) : null}

      <Button
        label="Enter payouts manually"
        variant="ghost"
        onPress={() => {
          const hasGeneratedPayouts =
            currencyMatches &&
            selectedTier !== null &&
            selectedTemplate !== null &&
            Object.values(draft.prize_rounds).some((amount) => amount > 0);

          onUpdate({
            prize_distribution_mode: "manual",
            ...(!hasGeneratedPayouts
              ? {
                  prize_tier_id: null,
                  prize_draw_template_id: null,
                  prize_player_total: 0,
                }
              : {}),
          });
        }}
      />
      <Text style={[styles.helper, { fontSize: 12, textAlign: "center" }]}>
        Source: {prizeDistributionRevision}
      </Text>
    </View>
  );
}
