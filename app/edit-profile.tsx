import { router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ProtectedScreen } from "@/components/auth/protected-screen";
import {
  ProfileForm,
  type ProfileFormValues,
} from "@/components/profile-form";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function EditProfileScreen() {
  return (
    <ProtectedScreen>
      <EditProfileContent />
    </ProtectedScreen>
  );
}

function EditProfileContent() {
  const { profile, saveProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return null;
  }

  async function handleSubmit(values: ProfileFormValues) {
    setError(null);
    setSaving(true);

    try {
      await saveProfile(values);
      router.back();
    } catch (saveError) {
      setError((saveError as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Profile",
          title: "Edit profile",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Athlete profile
          </Text>
          <Text style={styles.subtitle}>
            Update the identity and home currency used across your tournament
            projections.
          </Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" selectable style={styles.error}>
            {error}
          </Text>
        ) : null}

        <ProfileForm
          fields="identity"
          loading={saving}
          profile={profile}
          submitLabel="Save profile"
          onSubmit={handleSubmit}
        />
      </ScrollView>
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
  error: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
});
