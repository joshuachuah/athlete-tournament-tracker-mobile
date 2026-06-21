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
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          boxShadow:
            "0 1px 2px rgba(14, 16, 18, 0.04), 0 8px 20px -8px rgba(14, 16, 18, 0.10)",
        },
        style,
      ]}
      {...props}
    />
  );
}
