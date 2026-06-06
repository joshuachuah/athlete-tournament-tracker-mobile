import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
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

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      <Text
        style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        selectable
      >
        Something went wrong
      </Text>
      <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

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
