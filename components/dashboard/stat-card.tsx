import { Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";

type StatTone = "profit" | "loss" | "neutral" | "warning";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: StatTone;
};

function toneColor(tone: StatTone) {
  switch (tone) {
    case "profit":
      return colors.profit;
    case "loss":
      return colors.loss;
    case "warning":
      return colors.warning;
    case "neutral":
      return colors.foreground;
  }
}

export function StatCard({ label, value, detail, tone = "neutral" }: StatCardProps) {
  return (
    <Card
      style={{
        flex: 1,
        minWidth: 150,
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.surfaceMuted,
        boxShadow: "none",
      }}
    >
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12.5,
          fontWeight: "500",
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={{
          color: toneColor(tone),
          fontSize: 20,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        selectable
      >
        {value}
      </Text>
      <Text
        style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 16 }}
        numberOfLines={2}
        selectable
      >
        {detail}
      </Text>
    </Card>
  );
}
