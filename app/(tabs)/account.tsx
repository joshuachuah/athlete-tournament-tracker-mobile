import { router } from "expo-router";
import {
  ChevronRight,
  Coins,
  ExternalLink,
  FileText,
  LockKeyhole,
  LogOut,
  Mail,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AccountDeletionDialog } from "@/components/account/account-deletion-dialog";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { accountDeletionInfoUrl, privacyPolicyUrl } from "@/lib/legal";

export default function AccountScreen() {
  const { deleteAccount, profile, session, signOut } = useAuth();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);

  if (!profile) {
    return null;
  }

  const identityProviders = session?.user?.app_metadata?.providers;
  const usesAppleSignIn =
    session?.user?.app_metadata?.provider === "apple" ||
    (Array.isArray(identityProviders) && identityProviders.includes("apple"));

  async function handleSignOut() {
    setSigningOut(true);
    setSessionError(null);

    try {
      await signOut();
      router.replace("/login");
    } catch (signOutError) {
      setSessionError((signOutError as Error).message);
      setSigningOut(false);
    }
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Account</Text>
          <Text style={styles.title}>Your account</Text>
          <Text style={styles.subtitle}>
            General account information stays here. Private finances require device
            authentication.
          </Text>
        </View>

        {sessionError ? (
          <Text accessibilityRole="alert" selectable style={styles.error}>
            {sessionError}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>General</Text>
          <View style={styles.list}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Mail color={colors.mutedForeground} size={18} strokeWidth={2.1} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Email</Text>
                <Text numberOfLines={1} selectable style={styles.rowDetail}>
                  {profile.email}
                </Text>
              </View>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Coins
                  color={colors.mutedForeground}
                  size={18}
                  strokeWidth={2.1}
                />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Home currency</Text>
                <Text selectable style={styles.rowDetail}>
                  {profile.home_currency.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Private</Text>
          <View style={styles.list}>
            <Pressable
              accessibilityHint="Authenticates before showing any financial values"
              accessibilityLabel="Private finances, device authentication required, locked"
              accessibilityRole="button"
              onPress={() => router.push("/private-finances")}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.lockIcon]}>
                <LockKeyhole color={colors.accent} size={18} strokeWidth={2.3} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Private finances</Text>
                <Text style={styles.rowDetail}>
                  {Platform.OS === "ios"
                    ? "Face ID required"
                    : "Biometrics required"}
                </Text>
              </View>
              <View style={styles.lockBadge}>
                <Text style={styles.lockBadgeText}>Locked</Text>
              </View>
              <ChevronRight
                color={colors.mutedForeground}
                size={18}
                strokeWidth={2}
              />
            </Pressable>
          </View>
          <Text style={styles.privacyNote}>
            Financial values are never rendered on this Account screen.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View style={styles.list}>
            <Pressable
              accessibilityHint="Opens the privacy policy in your browser"
              accessibilityRole="link"
              onPress={() => Linking.openURL(privacyPolicyUrl)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <FileText
                  color={colors.mutedForeground}
                  size={18}
                  strokeWidth={2.1}
                />
              </View>
              <Text style={styles.rowTitle}>Privacy policy</Text>
              <ExternalLink
                color={colors.mutedForeground}
                size={17}
                strokeWidth={2}
              />
            </Pressable>
            <View style={styles.separator} />
            <Pressable
              accessibilityHint="Opens account deletion information in your browser"
              accessibilityRole="link"
              onPress={() => Linking.openURL(accountDeletionInfoUrl)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Trash2
                  color={colors.mutedForeground}
                  size={18}
                  strokeWidth={2.1}
                />
              </View>
              <Text style={styles.rowTitle}>Account deletion information</Text>
              <ExternalLink
                color={colors.mutedForeground}
                size={17}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <View style={styles.list}>
            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              onPress={handleSignOut}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.signOutIcon]}>
                <LogOut color={colors.loss} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.rowTitle, styles.signOutText]}>Sign out</Text>
              {signingOut ? <ActivityIndicator color={colors.loss} /> : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Danger zone</Text>
          <View style={[styles.list, styles.dangerList]}>
            <Pressable
              accessibilityHint="Opens details about permanently deleting your account"
              accessibilityLabel="Delete account"
              accessibilityRole="button"
              onPress={() => setDeletionOpen(true)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.signOutIcon]}>
                <Trash2 color={colors.loss} size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, styles.destructiveText]}>
                  Delete account
                </Text>
                <Text style={styles.rowDetail}>Permanently remove your data</Text>
              </View>
              <ChevronRight color={colors.loss} size={18} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {deletionOpen ? (
        <AccountDeletionDialog
          onClose={() => setDeletionOpen(false)}
          onDelete={deleteAccount}
          usesAppleSignIn={usesAppleSignIn}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  heading: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    maxWidth: 350,
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xs,
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  list: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  lockIcon: {
    backgroundColor: colors.accentSoft,
  },
  signOutIcon: {
    backgroundColor: colors.lossSoft,
  },
  rowCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  rowDetail: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  lockBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  lockBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
    backgroundColor: colors.border,
  },
  privacyNote: {
    paddingHorizontal: spacing.xs,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  signOutText: {
    flex: 1,
    color: colors.loss,
  },
  destructiveText: {
    color: colors.loss,
  },
  dangerList: {
    borderColor: colors.lossSoft,
  },
});
