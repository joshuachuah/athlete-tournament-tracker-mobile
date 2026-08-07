import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileLoadError } from "@/components/auth/profile-load-error";
import { GoogleLogo } from "@/components/ui/google-logo";
import { LoadingState } from "@/components/ui/loading-state";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

function returnToIntroduction() {
  router.replace("/");
}

export default function LoginScreen() {
  const {
    authError,
    profile,
    profileLoadError,
    session,
    signInWithApple,
    signInWithGoogle,
    status,
  } = useAuth();
  const [signingInWith, setSigningInWith] = useState<"apple" | "google" | null>(
    null,
  );
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) {
          setAppleSignInAvailable(available);
        }
      })
      .catch(() => {
        if (active) {
          setAppleSignInAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (session && status === "loading") {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <LoadingState label="Loading Athlete Tracker" />
      </SafeAreaView>
    );
  }

  if (status === "ready" && session && profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (
    status === "ready" &&
    session &&
    profileLoadError !== null
  ) {
    return <ProfileLoadError />;
  }

  if (status === "ready" && session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  function handleGoogleContinue() {
    setSigningInWith("google");

    const haptic =
      process.env.EXPO_OS === "ios"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          )
        : Promise.resolve();

    return haptic
      .then(signInWithGoogle)
      .finally(() => setSigningInWith(null));
  }

  function handleAppleContinue() {
    setSigningInWith("apple");

    return signInWithApple().finally(() => setSigningInWith(null));
  }

  const isLoading = status === "loading" || signingInWith !== null;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="login-scroll-view"
      >
        <View style={styles.navigation}>
          <Pressable
            accessibilityLabel="Back to introduction"
            accessibilityRole="button"
            hitSlop={8}
            onPress={returnToIntroduction}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <ArrowLeft color={colors.brand} size={21} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.brand}>
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              source={require("../assets/images/athlete-tracker-icon.png")}
              style={styles.brandMark}
            />
            <Text style={styles.brandName}>Athlete Tracker</Text>
          </View>
          <View style={styles.navigationSpacer} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.title} selectable>
            Log in or sign{"\u00A0"}up.
          </Text>
          <Text style={styles.subtitle} selectable>
            Choose a secure option below. If you’re new, we’ll create your
            account along the{"\u00A0"}way.
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

          {appleSignInAvailable ? (
            <View
              pointerEvents={isLoading ? "none" : "auto"}
              style={[
                styles.appleButtonContainer,
                {
                  opacity:
                    isLoading && signingInWith !== "apple" ? 0.6 : 1,
                },
              ]}
            >
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                cornerRadius={radii.lg}
                onPress={handleAppleContinue}
                style={styles.appleButton}
              />
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
            accessibilityHint="Opens Google sign in in a secure browser"
            accessibilityState={{ busy: isLoading, disabled: isLoading }}
            disabled={isLoading}
            onPress={handleGoogleContinue}
            style={({ pressed }) => [
              styles.googleButton,
              { opacity: isLoading ? 0.6 : pressed ? 0.9 : 1 },
            ]}
          >
            <View accessible={false} style={styles.googleContent}>
              {signingInWith === "google" ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <View style={styles.googleMark}>
                  <GoogleLogo size={18} />
                </View>
              )}
              <Text style={styles.googleLabel}>
                {signingInWith === "google"
                  ? "Just a moment…"
                  : "Continue with Google"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.trust}>
            <ShieldCheck
              color={colors.brand}
              size={14}
              strokeWidth={2.4}
            />
            <Text style={styles.trustText}>
              Secure sign-in · no password to remember
            </Text>
          </View>
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
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  navigation: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    backgroundColor: colors.surface,
  },
  backButtonPressed: {
    opacity: 0.65,
  },
  navigationSpacer: {
    width: 42,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderCurve: "continuous",
  },
  brandName: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  hero: {
    flexGrow: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  eyebrow: {
    color: colors.profit,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  title: {
    color: colors.brand,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
    textAlign: "center",
  },
  cta: {
    gap: spacing.md,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  appleButtonContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  appleButton: {
    width: "100%",
    height: 56,
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    transform: [{ translateX: -4 }],
  },
  googleMark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  googleLabel: {
    color: colors.brand,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  trustText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "400",
  },
});
