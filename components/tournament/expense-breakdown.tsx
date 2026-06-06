import { Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { MoneyPair } from "@/components/tournament/money-pair";
import { colors, spacing } from "@/constants/theme";
import type { TournamentWithPnL } from "@/types";
import { formatMoney } from "@/lib/utils";

const rows = [
  ["Flights", "flight_cost"],
  ["Accommodation", "accommodation_total"],
  ["Daily cap x days", "daily_spending_cap"],
  ["Coaching / physio", "coaching_cost"],
  ["Entry fee", "entry_fee"],
  ["Misc", "misc_cost"],
] as const;

export function ExpenseBreakdown({ tournament }: { tournament: TournamentWithPnL }) {
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
      {rows.map(([label, key]) => {
        const rawAmount = tournament[key];
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
            <MoneyPair
              amount={amount}
              fromCurrency={tournament.home_currency}
              toCurrency={tournament.currency}
            />
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
          Server-adjusted total
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
