import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { colors, spacing } from "@/constants/theme";
import { PROFILE_LOAD_FALLBACK_MESSAGE, useAuth } from "@/context/auth";

export function ProfileLoadError() {
  const { profileLoadError, refreshProfile, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  function handleRetry() {
    setSignOutError(null);
    void refreshProfile().catch(() => undefined);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
    } catch (error) {
      setSignOutError((error as Error).message);
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <ErrorState
          message={profileLoadError || PROFILE_LOAD_FALLBACK_MESSAGE}
          onRetry={handleRetry}
        />
        <View style={styles.actions}>
          {signOutError ? (
            <Text accessibilityRole="alert" selectable style={styles.error}>
              {signOutError}
            </Text>
          ) : null}
          <Button
            label={signingOut ? "Signing out…" : "Sign out"}
            loading={signingOut}
            variant="ghost"
            onPress={handleSignOut}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  error: {
    color: colors.loss,
    lineHeight: 20,
  },
});
