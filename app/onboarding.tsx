import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";

import { Card } from "@/components/ui/card";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function OnboardingScreen() {
  return (
    <ProtectedScreen requireProfile={false}>
      <OnboardingContent />
    </ProtectedScreen>
  );
}

function OnboardingContent() {
  const { saveProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 28, fontWeight: "900" }}
        selectable
      >
        Set up your athlete profile
      </Text>
      {error ? (
        <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
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
    </ScrollView>
  );
}
