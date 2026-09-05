import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/constants/theme";

export function ErrorState({
  message,
  onRetry,
  textAlign = "left",
}: {
  message: string;
  onRetry?: () => void;
  textAlign?: "left" | "center";
}) {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      <Text
        style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", textAlign }}
        selectable
      >
        Something went wrong
      </Text>
      <Text
        style={{ color: colors.mutedForeground, lineHeight: 20, textAlign }}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        selectable
      >
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
