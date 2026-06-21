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

  // Profitable → green, low runway → amber, otherwise a neutral (ink) state.
  // Neutral must NOT read as green: accent and profit share a hue now, so an
  // informational runway would otherwise look like a profit.
  const accentColor = profitable
    ? colors.profit
    : warning
      ? colors.warning
      : colors.mutedForeground;
  const backgroundColor = profitable
    ? colors.profitSoft
    : warning
      ? colors.warningSoft
      : colors.surfaceMuted;
  const borderColor = profitable
    ? colors.profit
    : warning
      ? colors.warning
      : colors.border;

  return (
    <Card
      style={{
        gap: spacing.sm,
        backgroundColor,
        borderColor,
      }}
    >
      <Text
        style={{
          color: accentColor,
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
