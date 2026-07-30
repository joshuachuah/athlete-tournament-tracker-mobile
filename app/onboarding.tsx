import { router } from "expo-router";
import { LogOut, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AccountDeletionDialog } from "@/components/account/account-deletion-dialog";
import { Card } from "@/components/ui/card";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function OnboardingScreen() {
  return (
    <ProtectedScreen requireProfile={false}>
      <OnboardingContent />
    </ProtectedScreen>
  );
}

function OnboardingContent() {
  const { deleteAccount, saveProfile, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);

  async function handleSubmit(values: ProfileFormValues) {
    setSaving(true);
    setError(null);

    try {
      await saveProfile(values);
      router.replace("/(tabs)/dashboard");
    } catch (profileError) {
      setError((profileError as Error).message);
    }

    setSaving(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      await signOut();
      router.replace("/login");
    } catch (signOutError) {
      setError((signOutError as Error).message);
      setSigningOut(false);
    }
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title} selectable>
          Set up your athlete profile
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error} selectable>
            {error}
          </Text>
        ) : null}
        <Card>
          <ProfileForm
            submitLabel="Save profile"
            loading={saving}
            onSubmit={handleSubmit}
          />
        </Card>

        <View style={styles.accountActions}>
          <Text style={styles.accountActionsTitle}>Not ready to set up?</Text>
          <Text style={styles.accountActionsBody}>
            You can sign out or permanently delete this new account without
            providing any profile or financial information.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionPressed,
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.foreground} />
            ) : (
              <LogOut color={colors.foreground} size={18} strokeWidth={2.1} />
            )}
            <Text style={styles.actionButtonText}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeletionOpen(true)}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.actionPressed,
            ]}
          >
            <Trash2 color={colors.loss} size={18} strokeWidth={2.1} />
            <Text style={styles.deleteButtonText}>Delete this account</Text>
          </Pressable>
        </View>
      </ScrollView>

      {deletionOpen ? (
        <AccountDeletionDialog
          onClose={() => setDeletionOpen(false)}
          onDelete={deleteAccount}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
  },
  error: {
    color: colors.loss,
    lineHeight: 20,
  },
  accountActions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountActionsTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
  },
  accountActionsBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  actionPressed: {
    opacity: 0.65,
  },
  actionButtonText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
  },
  deleteButtonText: {
    color: colors.loss,
    fontSize: 15,
    fontWeight: "700",
  },
});
