import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { colors, spacing } from "@/constants/theme";
import { PROFILE_LOAD_FALLBACK_MESSAGE, useAuth } from "@/context/auth";

export function ProfileLoadError() {
  const { profileLoadError, refreshProfile, signOut } = useAuth();

  function handleRetry() {
    void refreshProfile().catch(() => undefined);
  }

  function handleSignOut() {
    void signOut().catch(() => undefined);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <ErrorState
          message={profileLoadError || PROFILE_LOAD_FALLBACK_MESSAGE}
          onRetry={handleRetry}
        />
        <View style={styles.actions}>
          <Button label="Sign out" variant="ghost" onPress={handleSignOut} />
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
    paddingHorizontal: spacing.xl,
  },
});
