import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  CircleDollarSign,
  MapPin,
  Trophy,
} from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileLoadError } from "@/components/auth/profile-load-error";
import { LoadingState } from "@/components/ui/loading-state";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

const highlights = [
  { icon: MapPin, label: "Travel" },
  { icon: Trophy, label: "Prize money" },
  { icon: CircleDollarSign, label: "True net" },
] as const;

export default function IntroductionScreen() {
  const { profile, profileLoadError, session, status } = useAuth();
  const { width } = useWindowDimensions();
  const heroSize = Math.min(width - spacing.xl * 4, 210);

  if (status === "loading") {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <LoadingState label="Loading Athlete Tracker" />
      </SafeAreaView>
    );
  }

  if (session && profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (session && profileLoadError !== null) {
    return <ProfileLoadError />;
  }

  if (session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  function handleContinue() {
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    }

    router.push("/login");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroVisual}>
          <View
            accessible={false}
            style={[styles.backdropCard, { width: heroSize, height: heroSize }]}
          />
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Athlete Tracker ribbon athlete mark"
            source={require("../assets/images/athlete-tracker-icon.png")}
            style={[styles.heroImage, { width: heroSize, height: heroSize }]}
          />
          <View style={styles.scorecard}>
            <View>
              <Text style={styles.scorecardEyebrow}>SEASON VIEW</Text>
              <Text style={styles.scorecardTitle}>Every event, settled.</Text>
            </View>
            <View style={styles.profitBadge}>
              <View style={styles.profitDot} />
              <Text style={styles.profitBadgeText}>Clear P&amp;L</Text>
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>BUILT FOR COMPETING ATHLETES</Text>
          <Text style={styles.title} selectable>
            Your season,{"\n"}in focus.
          </Text>
          <Text style={styles.subtitle} selectable>
            Bring travel, fees, support and prize money together—then know what
            every tournament really returned.
          </Text>
        </View>

        <View style={styles.highlights}>
          {highlights.map(({ icon: Icon, label }) => (
            <View key={label} style={styles.highlight}>
              <Icon color={colors.brand} size={16} strokeWidth={2.2} />
              <Text style={styles.highlightText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityHint="Opens the login or account creation page"
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
          >
            <Text style={styles.continueLabel}>Get started</Text>
            <ArrowRight
              accessible={false}
              color={colors.brandForeground}
              size={20}
              strokeWidth={2.4}
            />
          </Pressable>
          <Text style={styles.footerNote}>Log in or create your free account</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  heroVisual: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
    alignItems: "center",
    paddingBottom: 39,
  },
  backdropCard: {
    position: "absolute",
    top: 14,
    borderRadius: 52,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceMuted,
    transform: [{ rotate: "6deg" }],
  },
  heroImage: {
    borderRadius: 52,
    borderCurve: "continuous",
    transform: [{ rotate: "-2deg" }],
  },
  scorecard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  scorecardEyebrow: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  scorecardTitle: {
    marginTop: 3,
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  profitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.profitSoft,
  },
  profitDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.profit,
  },
  profitBadgeText: {
    color: colors.profit,
    fontSize: 11,
    fontWeight: "800",
  },
  copy: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.profit,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.brand,
    fontSize: 40,
    lineHeight: 43,
    fontWeight: "800",
    letterSpacing: -1.25,
  },
  subtitle: {
    maxWidth: 340,
    color: colors.mutedForeground,
    fontSize: 16,
    lineHeight: 24,
  },
  highlights: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  highlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  highlightText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    marginTop: "auto",
    gap: spacing.sm,
  },
  continueButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.brand,
  },
  continueButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  continueLabel: {
    color: colors.brandForeground,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  footerNote: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: "center",
  },
});
