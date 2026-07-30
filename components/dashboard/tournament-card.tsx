import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

import { Card } from "@/components/ui/card";
import { colors, radii, spacing } from "@/constants/theme";
import type { TournamentWithPnL } from "@/types";
import { formatDate, formatMoney, getScenario } from "@/lib/utils";

export function TournamentCard({ tournament }: { tournament: TournamentWithPnL }) {
  const realistic = getScenario(tournament, "realistic");
  const formattedDate = formatDate(tournament.start_date);
  const outcomeLabel = !realistic
    ? "Needs projection"
    : realistic.net_result > 0
      ? `Profit · ${formatMoney(realistic.net_result, tournament.home_currency)}`
      : realistic.net_result < 0
        ? `Loss · ${formatMoney(realistic.net_result, tournament.home_currency)}`
        : `Break-even · ${formatMoney(realistic.net_result, tournament.home_currency)}`;
  const outcomeColor = !realistic
    ? colors.foreground
    : realistic.net_result > 0
      ? colors.profit
      : realistic.net_result < 0
        ? colors.loss
        : colors.foreground;
  const accessibilityOutcome = !realistic
    ? "needs projection"
    : `realistic net ${outcomeLabel}`;

  return (
    <Link href={`/tournaments/${tournament.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${tournament.name}. ${tournament.location}, ${formattedDate}. ${accessibilityOutcome}.`}
        accessibilityHint="Opens tournament details"
      >
        {({ pressed }) => (
          <Card
            style={[styles.card, { opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text
                  style={styles.name}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.name}
                </Text>
                <Text
                  style={styles.detail}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.location} · {formattedDate}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
                selectable
                style={[styles.outcome, { color: outcomeColor }]}
              >
                {outcomeLabel}
              </Text>
            </View>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 10px 24px -18px rgba(16, 23, 18, 0.28)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  detail: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  outcome: {
    alignSelf: "flex-start",
    maxWidth: "42%",
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    lineHeight: 19,
    textAlign: "right",
  },
});
