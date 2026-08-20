import { Redirect, router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { privacyPolicyUrl } from "@/lib/legal";

function returnToIntroduction() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

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
  const [signingInWith, setSigningInWith] = useState<
    "apple" | "google" | null
  >(null);
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

  if (status === "ready" && session && profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (status === "loading" && session) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <LoadingState label="Loading athlete profile" />
      </SafeAreaView>
    );
  }

  if (status === "ready" && session && profileLoadError !== null) {
    return <ProfileLoadError />;
  }

  if (status === "ready" && session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  function handleGoogleContinue() {
    setSigningInWith("google");

    if (process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => undefined,
      );
    }

    return signInWithGoogle().finally(() => setSigningInWith(null));
  }

  function handleAppleContinue() {
    setSigningInWith("apple");

    return signInWithApple().finally(() => setSigningInWith(null));
  }

  const isLoading = status === "loading" || signingInWith !== null;

  return (
    <LinearGradient
      colors={["#061C14", "#0A3A28", "#0E6542"]}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.54, 1]}
      start={{ x: 0.08, y: 0 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="login-scroll-view"
        >
          <View style={styles.navigation}>
            <Pressable
              accessibilityLabel="Close account screen"
              accessibilityRole="button"
              hitSlop={8}
              onPress={returnToIntroduction}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <X color="#FFFFFF" size={22} strokeWidth={1.9} />
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="Athlete Tracker app icon"
              source={require("../assets/images/athlete-tracker-splash-icon.png")}
              style={styles.mark}
            />
            <View style={styles.tag}>
              <Text style={styles.tagLabel}>ATHLETE TRACKER</Text>
            </View>
            <Text style={styles.title} selectable>
              Your season, in focus.
            </Text>
            <Text style={styles.subtitle} selectable>
              Sign in or create an account to keep every tournament in one
              clear view.
            </Text>
          </View>

          <View style={styles.authPanel}>
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
              onPress={handleGoogleContinue}
              style={({ pressed }) => [
                styles.googleButton,
                isLoading && styles.providerButtonDisabled,
                pressed && !isLoading && styles.providerButtonPressed,
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

            <Text style={styles.legal} selectable>
              By continuing, you acknowledge our{" "}
              <Text
                accessibilityHint="Opens the privacy policy in your browser"
                accessibilityRole="link"
                onPress={() => Linking.openURL(privacyPolicyUrl)}
                style={styles.legalLink}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
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
    backgroundColor: "#08281B",
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  navigation: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  backButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  identity: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  mark: {
    width: 104,
    height: 104,
    marginBottom: spacing.lg,
    borderRadius: 29,
    borderCurve: "continuous",
  },
  tag: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(211, 255, 226, 0.24)",
    borderRadius: 999,
    backgroundColor: "rgba(211, 255, 226, 0.1)",
  },
  tagLabel: {
    color: "#D6FFE4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.45,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 330,
    marginTop: spacing.sm,
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  authPanel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: "rgba(3, 22, 15, 0.34)",
  },
  error: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: "rgba(200, 64, 50, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 160, 148, 0.55)",
  },
  errorText: {
    color: "#FFD7D1",
    fontSize: 14,
    lineHeight: 20,
  },
  googleButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  providerButtonDisabled: {
    opacity: 0.6,
  },
  providerButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  appleButtonContainer: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
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
    color: colors.foreground,
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: -0.2,
    transform: [{ translateX: spacing.xxs }],
  },
  legal: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  legalLink: {
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
});
