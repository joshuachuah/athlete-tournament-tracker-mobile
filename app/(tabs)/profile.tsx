import { router } from "expo-router";
import { Flag, Medal } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

function profileInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfileScreen() {
  const { profile } = useAuth();

  if (!profile) {
    return null;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Your athlete identity</Text>
        <Text style={styles.subtitle}>
          The essentials teammates and tournament staff use to recognise you.
        </Text>
      </View>

      <View style={styles.identityCard}>
        <View
          accessibilityLabel={`${profile.name} profile picture`}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{profileInitials(profile.name)}</Text>
        </View>
        <Text selectable style={styles.name}>
          {profile.name}
        </Text>
        <View style={styles.identityDetails}>
          <View style={styles.identityPill}>
            <Flag color={colors.accent} size={17} strokeWidth={2.2} />
            <View style={styles.identityCopy}>
              <Text style={styles.detailLabel}>Home country</Text>
              <Text selectable style={styles.detailValue}>
                {profile.home_country}
              </Text>
            </View>
          </View>
          <View style={styles.identityPill}>
            <Medal color={colors.accent} size={17} strokeWidth={2.2} />
            <View style={styles.identityCopy}>
              <Text style={styles.detailLabel}>Sport</Text>
              <Text selectable style={styles.detailValue}>
                {profile.sport}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Button
        label="Edit profile"
        variant="secondary"
        onPress={() => router.push("/edit-profile")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    padding: spacing.xl,
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
    maxWidth: 340,
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
  identityCard: {
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow:
      "0 2px 4px rgba(14, 16, 18, 0.04), 0 18px 34px -18px rgba(14, 16, 18, 0.18)",
  },
  avatar: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 46,
    borderWidth: 6,
    borderColor: colors.accentSoft,
    backgroundColor: colors.foreground,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  name: {
    color: colors.foreground,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  identityDetails: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
  },
  identityPill: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceMuted,
  },
  identityCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
});
