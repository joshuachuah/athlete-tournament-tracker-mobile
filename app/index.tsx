import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function IndexRoute() {
  const { session, profile, status } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.mutedForeground }} selectable>
          Loading athlete tracker
        </Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
