import { ActivityIndicator, Text, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      style={{
        padding: spacing.xl,
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.mutedForeground }} selectable>
        {label}
      </Text>
    </View>
  );
}
