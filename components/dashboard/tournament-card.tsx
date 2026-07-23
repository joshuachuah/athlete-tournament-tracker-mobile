import { Pressable, Text, View } from "react-native";
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
  const outcomeBackgroundColor = !realistic
    ? colors.surfaceMuted
    : realistic.net_result > 0
      ? colors.profitSoft
      : realistic.net_result < 0
        ? colors.lossSoft
        : colors.surfaceMuted;
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
            style={{
              opacity: pressed ? 0.75 : 1,
              borderRadius: radii.lg,
              padding: spacing.md,
              boxShadow:
                "0 1px 2px rgba(14, 16, 18, 0.03), 0 8px 18px -12px rgba(14, 16, 18, 0.12)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                <Text
                  style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.name}
                </Text>
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.location} · {formattedDate}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "46%",
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 5,
                  borderRadius: radii.sm,
                  backgroundColor: outcomeBackgroundColor,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  selectable
                >
                  {outcomeLabel}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}
