import { Plus, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { formatDate, formatMoney, parseDateOnly } from "@/lib/utils";
import type { TournamentDraft } from "@/lib/tournament-draft";

export type AssumptionEditor =
  | "daily-spending"
  | "coaching"
  | "misc"
  | "sponsorship"
  | "subsidy";

export type ProjectionEditor = "details" | "prize" | "travel" | AssumptionEditor;

type LedgerRowProps = {
  title: string;
  summary: string;
  impact?: string;
  impactTone?: "positive" | "negative" | "neutral";
  onPress: () => void;
};

function ImpactLedgerRow({
  impact,
  impactTone = "neutral",
  onPress,
  summary,
  title,
}: LedgerRowProps) {
  const impactColor =
    impactTone === "positive"
      ? colors.profit
      : impactTone === "negative"
        ? colors.loss
        : colors.foreground;

  return (
    <Pressable
      accessibilityHint={`Opens the ${title.toLowerCase()} editor`}
      accessibilityLabel={`${title}. ${summary}${impact ? `. ${impact}` : ""}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
          {title}
        </Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 19 }}>
          {summary}
        </Text>
      </View>
      {impact ? (
        <Text
          style={{
            color: impactColor,
            fontSize: 15,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          {impact}
        </Text>
      ) : null}
      <ChevronRight color={colors.mutedForeground} size={20} />
    </Pressable>
  );
}

function signedMoney(amount: number, currency: string, sign: "+" | "−") {
  return amount > 0 ? `${sign}${formatMoney(amount, currency)}` : formatMoney(0, currency);
}

function prizeEstimates(draft: TournamentDraft) {
  return Object.values(draft.prize_rounds).filter((amount) => amount > 0);
}

function optionalAssumptions(draft: TournamentDraft) {
  const rows: Array<LedgerRowProps & { key: AssumptionEditor }> = [];

  if (draft.daily_spending_cap > 0) {
    rows.push({
      key: "daily-spending",
      title: "Daily spending cap",
      summary: "Maximum planned spend per day",
      impact: `${signedMoney(draft.daily_spending_cap, draft.currency, "−")} / day`,
      impactTone: "negative",
      onPress: () => undefined,
    });
  }
  if (draft.coaching_cost > 0) {
    rows.push({
      key: "coaching",
      title: "Coaching / physio",
      summary: "Support cost for this tournament",
      impact: signedMoney(draft.coaching_cost, draft.currency, "−"),
      impactTone: "negative",
      onPress: () => undefined,
    });
  }
  if (draft.misc_cost > 0) {
    rows.push({
      key: "misc",
      title: "Miscellaneous",
      summary: "Other tournament costs",
      impact: signedMoney(draft.misc_cost, draft.currency, "−"),
      impactTone: "negative",
      onPress: () => undefined,
    });
  }
  if (draft.sponsorship_allocated > 0) {
    rows.push({
      key: "sponsorship",
      title: "Sponsorship",
      summary: "Funding allocated to this tournament",
      impact: signedMoney(draft.sponsorship_allocated, draft.currency, "+"),
      impactTone: "positive",
      onPress: () => undefined,
    });
  }
  if (draft.subsidy_enabled) {
    rows.push({
      key: "subsidy",
      title: "Subsidy",
      summary: draft.subsidy_by.trim() || "Tournament subsidy",
      impact: signedMoney(draft.subsidy_amount, draft.currency, "+"),
      impactTone: "positive",
      onPress: () => undefined,
    });
  }

  return rows;
}

export function ImpactLedger({
  draft,
  onAddAssumption,
  onOpenEditor,
}: {
  draft: TournamentDraft;
  onAddAssumption: () => void;
  onOpenEditor: (editor: ProjectionEditor) => void;
}) {
  const prizes = prizeEstimates(draft);
  const lowestPrize = prizes.length > 0 ? Math.min(...prizes) : 0;
  const highestPrize = prizes.length > 0 ? Math.max(...prizes) : 0;
  const travel = draft.flight_cost + draft.accommodation_total;
  const assumptions = optionalAssumptions(draft);
  const detailSummary = draft.location.trim()
    ? `${draft.location.trim()}${parseDateOnly(draft.start_date) ? ` · ${formatDate(draft.start_date)}` : ""}`
    : "Location, dates, currency, and entry fee";
  const prizeSummary =
    prizes.length > 0
      ? `${prizes.length} round estimate${prizes.length === 1 ? "" : "s"}${draft.prize_tax_rate > 0 ? ` · ${draft.prize_tax_rate}% tax` : ""}`
      : "Prize rounds and tax withholding";
  const prizeImpact =
    prizes.length === 0
      ? formatMoney(0, draft.currency)
      : prizes.length === 1 || lowestPrize === highestPrize
        ? `Up to +${formatMoney(highestPrize, draft.currency)}`
        : `+${formatMoney(lowestPrize, draft.currency)}–+${formatMoney(highestPrize, draft.currency)}`;
  const travelSummary =
    travel > 0
      ? `${draft.accommodation_nights} night${draft.accommodation_nights === 1 ? "" : "s"} planned`
      : "Flights and accommodation";

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Impact ledger
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900" }}>
          Build the projection
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderCurve: "continuous",
        }}
      >
        <ImpactLedgerRow
          title="Tournament details"
          summary={detailSummary}
          impact={signedMoney(draft.entry_fee, draft.currency, "−")}
          impactTone={draft.entry_fee > 0 ? "negative" : "neutral"}
          onPress={() => onOpenEditor("details")}
        />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <ImpactLedgerRow
          title="Prize and tax"
          summary={prizeSummary}
          impact={prizeImpact}
          impactTone={prizes.length > 0 ? "positive" : "neutral"}
          onPress={() => onOpenEditor("prize")}
        />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <ImpactLedgerRow
          title="Travel and stay"
          summary={travelSummary}
          impact={signedMoney(travel, draft.currency, "−")}
          impactTone={travel > 0 ? "negative" : "neutral"}
          onPress={() => onOpenEditor("travel")}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Optional assumptions
        </Text>
        {assumptions.length > 0 ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.lg,
              borderCurve: "continuous",
            }}
          >
            {assumptions.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                ) : null}
                <ImpactLedgerRow
                  title={row.title}
                  summary={row.summary}
                  impact={row.impact}
                  impactTone={row.impactTone}
                  onPress={() => onOpenEditor(row.key)}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            Add only the costs or funding that apply to this tournament.
          </Text>
        )}

        <Pressable
          accessibilityHint="Opens a searchable list of supported assumptions"
          accessibilityLabel="Add optional assumption"
          accessibilityRole="button"
          onPress={onAddAssumption}
          style={({ pressed }) => ({
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.accent,
            borderRadius: radii.md,
            backgroundColor: colors.accentSoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "800" }}>
            Add optional assumption
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
