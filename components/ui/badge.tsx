import { Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type BadgeTone = "profit" | "loss" | "warning" | "neutral" | "accent";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

function toneColors(tone: BadgeTone) {
  switch (tone) {
    case "profit":
      return { backgroundColor: colors.profitSoft, color: colors.profit };
    case "loss":
      return { backgroundColor: colors.lossSoft, color: colors.loss };
    case "warning":
      return { backgroundColor: colors.warningSoft, color: colors.warning };
    case "accent":
      return { backgroundColor: colors.accentSoft, color: colors.accent };
    case "neutral":
      return { backgroundColor: colors.surfaceMuted, color: colors.mutedForeground };
  }
}

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const palette = toneColors(tone);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radii.sm,
        borderCurve: "continuous",
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        backgroundColor: palette.backgroundColor,
      }}
    >
      <Text
        style={{
          color: palette.color,
          fontSize: 13,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
        selectable
      >
        {label}
      </Text>
    </View>
  );
}
