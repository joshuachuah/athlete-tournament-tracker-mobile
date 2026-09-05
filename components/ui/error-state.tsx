import { StyleSheet, Text, View } from "react-native";

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
    <View style={styles.container}>
      <Text
        style={[styles.title, styles[textAlign]]}
        selectable
      >
        Something went wrong
      </Text>
      <Text
        style={[styles.message, styles[textAlign]]}
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

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "700",
  },
  message: {
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  left: {
    textAlign: "left",
  },
  center: {
    textAlign: "center",
  },
});
