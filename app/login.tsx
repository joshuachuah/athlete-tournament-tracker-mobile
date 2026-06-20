import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { ArrowRight, ShieldCheck, TrendingUp } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function LoginScreen() {
  const { authError, profile, session, signInWithGoogle, status } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (status === "ready" && session && profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (status === "ready" && session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  function handleContinue() {
    setIsSigningIn(true);

    const haptic =
      process.env.EXPO_OS === "ios"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          )
        : Promise.resolve();

    return haptic.then(signInWithGoogle).finally(() => setIsSigningIn(false));
  }

  const isLoading = status === "loading" || isSigningIn;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <TrendingUp color="#FFFFFF" size={18} strokeWidth={2.6} />
        </View>
        <Text style={styles.brandName}>Athlete Tracker</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title} selectable>
          Know your net,{"\n"}every tournament.
        </Text>
        <Text style={styles.subtitle} selectable>
          Travel, fees and prize money — settled to a single profit or loss per
          event.
        </Text>
      </View>

      <View style={styles.cta}>
        {authError ? (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={styles.errorText} selectable>
              {authError}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
          accessibilityHint="Opens Google sign in in a secure browser"
          accessibilityState={{ busy: isLoading, disabled: isLoading }}
          disabled={isLoading}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.googleButton,
            { opacity: isLoading ? 0.6 : pressed ? 0.9 : 1 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View accessible={false} style={styles.googleMark}>
              <Text style={styles.googleLetter}>G</Text>
            </View>
          )}
          <Text style={styles.googleLabel}>
            {isLoading ? "Just a moment…" : "Continue with Google"}
          </Text>
          {!isLoading ? (
            <ArrowRight
              accessible={false}
              color="#FFFFFF"
              size={18}
              strokeWidth={2.6}
            />
          ) : null}
        </Pressable>

        <View style={styles.trust}>
          <ShieldCheck
            color={colors.mutedForeground}
            size={14}
            strokeWidth={2.4}
          />
          <Text style={styles.trustText}>
            One secure account · stored safely on this device
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  brandMark: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderCurve: "continuous",
    backgroundColor: colors.foreground,
  },
  brandName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  cta: {
    gap: spacing.lg,
  },
  error: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.lossSoft,
    borderWidth: 1,
    borderColor: colors.loss,
  },
  errorText: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
  googleButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.foreground,
  },
  googleMark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  googleLetter: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  googleLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  trustText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "400",
  },
});
