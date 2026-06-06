import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function ProfileScreen() {
  const { profile, session, saveProfile, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  async function handleSubmit(values: ProfileFormValues) {
    setSaving(true);
    setError(null);

    try {
      await saveProfile(values);
    } catch (profileError) {
      setError((profileError as Error).message);
    }

    setSaving(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          Profile
        </Text>
        <Text
          style={{ color: colors.foreground, fontSize: 30, fontWeight: "900" }}
          selectable
        >
          {profile.name}
        </Text>
        <Text style={{ color: colors.mutedForeground }} selectable>
          {profile.sport} · {profile.home_country}
        </Text>
      </View>

      {error ? (
        <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
          {error}
        </Text>
      ) : null}

      <Card>
        <ProfileForm
          profile={profile}
          submitLabel="Save changes"
          loading={saving}
          onSubmit={handleSubmit}
        />
      </Card>

      <Button label="Sign out" variant="danger" onPress={handleSignOut} />
    </ScrollView>
  );
}
