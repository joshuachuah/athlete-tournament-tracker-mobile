import { Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MoneyPair } from "@/components/tournament/money-pair";
import { colors, spacing } from "@/constants/theme";
import type { ScenarioResult } from "@/types";
import { roundLabels, scenarioLabel } from "@/lib/utils";

export function ScenarioCard({
  result,
  homeCurrency,
  tournamentCurrency,
  prizeTaxRate = null,
}: {
  result: ScenarioResult;
  homeCurrency: string;
  tournamentCurrency: string;
  prizeTaxRate?: number | null;
}) {
  const hasEstimatedWithholding = prizeTaxRate !== null;

  return (
    <Card style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "800",
            }}
            selectable
          >
            {scenarioLabel(result.scenario)}
          </Text>
          <Text style={{ color: colors.mutedForeground }} selectable>
            Round: {roundLabels[result.round]}
          </Text>
        </View>
        <Badge
          label={result.profitable ? "Profitable" : "Loss"}
          tone={result.profitable ? "profit" : "loss"}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xl, flexWrap: "wrap" }}>
        <MoneyPair
          label="Prize"
          amount={result.prize_money}
          fromCurrency={homeCurrency}
          toCurrency={tournamentCurrency}
        />
        {hasEstimatedWithholding ? (
          <MoneyPair
            label="Prize after estimated withholding"
            amount={
              result.prize_money_after_estimated_withholding ??
              result.prize_money_after_tax
            }
            fromCurrency={homeCurrency}
            toCurrency={tournamentCurrency}
          />
        ) : null}
        <MoneyPair
          label="Net"
          amount={result.net_result}
          fromCurrency={homeCurrency}
          toCurrency={tournamentCurrency}
        />
      </View>
      {hasEstimatedWithholding ? (
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
          Net uses a {prizeTaxRate}% estimated withholding rate on prize money.
        </Text>
      ) : null}
    </Card>
  );
}
