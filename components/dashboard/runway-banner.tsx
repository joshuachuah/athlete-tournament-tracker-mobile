import { Text } from "react-native";

import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";
import { formatMoney } from "@/lib/utils";

type RunwayBannerProps = {
  runway: number | null;
  averageNetSpend: number;
  currency: string;
};

export function RunwayBanner({
  runway,
  averageNetSpend,
  currency,
}: RunwayBannerProps) {
  const profitable = runway === null;
  const warning = runway !== null && runway <= 3;

  return (
    <Card
      style={{
        gap: spacing.sm,
        backgroundColor: profitable
          ? colors.profitSoft
          : warning
            ? colors.warningSoft
            : colors.accentSoft,
        borderColor: profitable
          ? colors.profit
          : warning
            ? colors.warning
            : colors.accent,
      }}
    >
      <Text
        style={{
          color: profitable
            ? colors.profit
            : warning
              ? colors.warning
              : colors.accent,
          fontSize: 12,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        Runway
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 22,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
        selectable
      >
        {profitable
          ? "Profitable on average"
          : `${runway} tournament${runway === 1 ? "" : "s"} remaining`}
      </Text>
      <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
        {profitable
          ? "Your realistic scenarios are not averaging a loss."
          : `Average realistic loss: ${formatMoney(averageNetSpend, currency)}.`}
      </Text>
    </Card>
  );
}
