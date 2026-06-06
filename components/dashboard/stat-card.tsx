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
    <Card style={{ flex: 1, minWidth: 150, gap: spacing.sm }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: toneColor(tone),
          fontSize: 24,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        selectable
      >
        {value}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }} selectable>
        {detail}
      </Text>
    </Card>
  );
}
