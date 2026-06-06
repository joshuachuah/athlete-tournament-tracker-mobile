import { Redirect } from "expo-router";
import { Text, View, ScrollView } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function LoginScreen() {
  const { authError, profile, session, signInWithGoogle, status } = useAuth();

  if (status === "ready" && session && profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (status === "ready" && session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          Athlete Tournament Tracker
        </Text>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 36,
            fontWeight: "900",
            lineHeight: 40,
          }}
          selectable
        >
          Track every tournament from your phone.
        </Text>
      </View>

      <Card>
        <Text style={{ color: colors.mutedForeground, lineHeight: 21 }} selectable>
          Sign in with the same Supabase account as the web app. The Flask API
          remains the source of truth for every P&L calculation.
        </Text>
        {authError ? (
          <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
            {authError}
          </Text>
        ) : null}
        <Button label="Continue with Google" onPress={signInWithGoogle} />
      </Card>
    </ScrollView>
  );
}
