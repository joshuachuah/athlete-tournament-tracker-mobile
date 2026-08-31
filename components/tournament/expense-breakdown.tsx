import { Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";
import type { TournamentWithPnL } from "@/types";
import { formatMoney } from "@/lib/utils";

const rows = [
  ["Flights", "flight_cost"],
  ["Accommodation", "accommodation_total"],
  ["Food", "food_total"],
  ["Local transport", "local_transport_total"],
  ["Coaching / physio", "coaching_cost"],
  ["Entry fee", "entry_fee"],
  ["Misc", "misc_cost"],
] as const;

export function ExpenseBreakdown({ tournament }: { tournament: TournamentWithPnL }) {
  const displayedRows =
    tournament.daily_spending_cap > 0
      ? ([
          ...rows.slice(0, 4),
          ["Other daily spending", "daily_spending_cap"] as const,
          ...rows.slice(4),
        ] as const)
      : rows;

  return (
    <Card>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 18,
          fontWeight: "800",
        }}
        selectable
      >
        Expense breakdown
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }} selectable>
        Category amounts in {tournament.currency.toUpperCase()}
      </Text>
      {displayedRows.map(([label, key]) => {
        const rawAmount = tournament[key] ?? 0;
        const amount =
          key === "daily_spending_cap"
            ? rawAmount * tournament.duration_days
            : rawAmount;

        return (
          <View
            key={key}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <Text style={{ color: colors.mutedForeground, flex: 1 }} selectable>
              {label}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
              selectable
            >
              {formatMoney(amount, tournament.currency)}
            </Text>
          </View>
        );
      })}

      <View
        style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingTop: spacing.md,
          gap: spacing.xs,
        }}
      >
        <Text style={{ color: colors.mutedForeground }} selectable>
          Total expenses in {tournament.home_currency.toUpperCase()}
        </Text>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
          selectable
        >
          {formatMoney(tournament.pnl.total_expenses, tournament.home_currency)}
        </Text>
      </View>
    </Card>
  );
}
