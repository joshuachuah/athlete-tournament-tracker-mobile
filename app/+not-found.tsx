import { Link } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/constants/theme";

export default function NotFound() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}
        selectable
      >
        Screen not found
      </Text>
      <Link href="/" asChild>
        <Button label="Back to app" />
      </Link>
    </View>
  );
}
