import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

import { Card } from "@/components/ui/card";
import { colors, radii, spacing } from "@/constants/theme";
import type { TournamentWithPnL } from "@/types";
import { formatDate, formatMoney, getScenario } from "@/lib/utils";

export function TournamentCard({ tournament }: { tournament: TournamentWithPnL }) {
  const realistic = getScenario(tournament, "realistic");
  const actualNet = tournament.actual_pnl?.net_result;
  const isFinal = actualNet !== undefined;
  const displayedNet = actualNet ?? realistic?.net_result;
  const displayedCurrency =
    tournament.actual_pnl?.home_currency ?? tournament.home_currency;
  const formattedDate = formatDate(tournament.start_date);
  const outcomeLabel = displayedNet === undefined
    ? "Needs projection"
    : displayedNet > 0
      ? `${isFinal ? "Final profit" : "Projected profit"} · ${formatMoney(displayedNet, displayedCurrency)}`
      : displayedNet < 0
        ? `${isFinal ? "Final loss" : "Projected loss"} · ${formatMoney(displayedNet, displayedCurrency)}`
        : `${isFinal ? "Final break-even" : "Projected break-even"} · ${formatMoney(displayedNet, displayedCurrency)}`;
  const outcomeColor = displayedNet === undefined
    ? colors.foreground
    : displayedNet > 0
      ? colors.profit
      : displayedNet < 0
        ? colors.loss
        : colors.foreground;
  const accessibilityOutcome = displayedNet === undefined
    ? "needs projection"
    : outcomeLabel;

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
    borderRadius: radii.md,
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
