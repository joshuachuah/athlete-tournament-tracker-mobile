import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AccountDeletionDialog } from "@/components/account/account-deletion-dialog";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function AccountControlsScreen() {
  return (
    <ProtectedScreen>
      <AccountControlsContent />
    </ProtectedScreen>
  );
}

function AccountControlsContent() {
  const { deleteAccount, profile, session, signOut } = useAuth();
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);

  const accountEmail = session?.user.email;

  if (!profile || !accountEmail) {
    return null;
  }

  async function confirmSignOut() {
    if (signingOutRef.current) {
      return;
    }

    signingOutRef.current = true;
    setSigningOut(true);
    setSessionError(null);

    try {
      await signOut();
      router.replace("/login");
    } catch (signOutError) {
      signingOutRef.current = false;
      setSessionError((signOutError as Error).message);
      setSigningOut(false);
    }
  }

  function requestSignOut() {
    Alert.alert("Sign out?", "You can sign back in with the same account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: confirmSignOut,
      },
    ]);
  }

  function requestDeletion() {
    if (signingOutRef.current) {
      return;
    }

    setDeletionOpen(true);
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={styles.screen}
      >
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Account controls
          </Text>
          <Text style={styles.subtitle}>
            Manage the session and account for {accountEmail}.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <Button
            accessibilityHint="Opens a confirmation before signing out"
            accessibilityLabel="Sign out"
            disabled={signingOut}
            label="Sign out"
            loading={signingOut}
            variant="secondary"
            onPress={requestSignOut}
          />
          {sessionError ? (
            <Text accessibilityRole="alert" selectable style={styles.error}>
              {sessionError}
            </Text>
          ) : null}
        </View>

        <View style={[styles.section, styles.deleteSection]}>
          <Text style={styles.deleteTitle}>Delete account</Text>
          <Text style={styles.deleteBody}>
            Permanently delete this account and all of its saved data.
          </Text>
          <Pressable
            accessibilityHint="Opens details about permanently deleting your account"
            accessibilityLabel="Delete account"
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut }}
            disabled={signingOut}
            onPress={requestDeletion}
            style={({ pressed }) => [
              styles.deleteAction,
              signingOut && styles.deleteActionDisabled,
              pressed && styles.deleteActionPressed,
            ]}
          >
            <Text style={styles.deleteActionText}>Delete account</Text>
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
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  error: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteSection: {
    marginTop: spacing.xxl,
  },
  deleteTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  deleteBody: {
    maxWidth: 350,
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteAction: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  deleteActionPressed: {
    opacity: 0.6,
  },
  deleteActionDisabled: {
    opacity: 0.45,
  },
  deleteActionText: {
    color: colors.loss,
    fontSize: 15,
    fontWeight: "700",
  },
});
