import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        padding: spacing.xl,
        gap: spacing.md,
        alignItems: "flex-start",
      }}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}
        selectable
      >
        {title}
      </Text>
      <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
        {body}
      </Text>
      {action}
    </View>
  );
}
