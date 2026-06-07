import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

type FeatureProps = {
  icon: LucideIcon;
  label: string;
};

function Feature({ icon: Icon, label }: FeatureProps) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Icon color="#FFFFFF" size={18} strokeWidth={2.4} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

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
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Trophy color="#FFFFFF" size={20} strokeWidth={2.4} />
          </View>
          <Text style={styles.brandName}>Athlete Tracker</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Compete with clarity</Text>

          <Text style={styles.title} selectable>
            Know your numbers before you enter.
          </Text>

          <Text style={styles.subtitle} selectable>
            Plan tournament costs, model prize outcomes, and protect your season
            runway — all from one focused dashboard.
          </Text>

          <View style={styles.features}>
            <Feature icon={Wallet} label="Plan every cost" />
            <Feature icon={Target} label="Find break-even" />
            <Feature icon={TrendingUp} label="Protect runway" />
          </View>
        </View>

        <View style={styles.cta}>
          <Text style={styles.accountDescription} selectable>
            Continue with Google to sign in or create an account. New athletes
            will set up their profile next.
          </Text>

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
              <ActivityIndicator color={colors.foreground} />
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
                color={colors.foreground}
                size={18}
                strokeWidth={2.6}
              />
            ) : null}
          </Pressable>

          <View style={styles.trust}>
            <ShieldCheck
              color="rgba(255, 255, 255, 0.5)"
              size={14}
              strokeWidth={2.4}
            />
            <Text style={styles.trustText}>
              One secure account · stored safely on this device
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#121110",
    overflow: "hidden",
  },
  content: {
    flexGrow: 1,
    gap: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.accent,
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  hero: {
    gap: spacing.lg,
  },
  eyebrow: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "400",
    letterSpacing: -1,
    lineHeight: 46,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
  },
  features: {
    flexDirection: "column",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  featureIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  featureLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
  },
  cta: {
    gap: spacing.lg,
  },
  accountDescription: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: "rgba(180, 35, 24, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(253, 227, 223, 0.25)",
  },
  errorText: {
    color: "#FDE3DF",
    fontSize: 14,
    lineHeight: 20,
  },
  googleButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
  },
  googleMark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  googleLetter: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  googleLabel: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  trustText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: "400",
  },
});
