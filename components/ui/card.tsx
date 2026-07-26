import { View, type ViewProps } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

export function Card({ style, ...props }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          borderCurve: "continuous",
          padding: spacing.lg,
          gap: spacing.md,
          boxShadow:
            "0 1px 2px rgba(16, 23, 18, 0.04), 0 12px 28px -18px rgba(16, 23, 18, 0.24)",
        },
        style,
      ]}
      {...props}
    />
  );
}
