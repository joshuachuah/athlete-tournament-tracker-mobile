import { router } from "expo-router";
import {
  ChevronRight,
  Coins,
  LockKeyhole,
  LogOut,
  Mail,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (!profile) {
    return null;
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.screen}
    >
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Your account</Text>
        <Text style={styles.subtitle}>
          General account information stays here. Private finances require device
          authentication.
        </Text>
      </View>

      {error ? (
        <Text accessibilityRole="alert" selectable style={styles.error}>
          {error}
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
              <Coins color={colors.mutedForeground} size={18} strokeWidth={2.1} />
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
                {Platform.OS === "ios" ? "Face ID required" : "Biometrics required"}
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>Locked</Text>
            </View>
            <ChevronRight color={colors.mutedForeground} size={18} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={styles.privacyNote}>
          Financial values are never rendered on this Account screen.
        </Text>
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
    </ScrollView>
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
  eyebrow: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
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
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 12px 28px -20px rgba(16, 23, 18, 0.24)",
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
});
