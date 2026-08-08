import { Redirect, router } from "expo-router";
import { useState } from "react";

import { AccountDeletionDialog } from "@/components/account/account-deletion-dialog";
import { ProtectedScreen } from "@/components/auth/protected-screen";
import {
  SetupFlow,
  type SetupProfileValues,
} from "@/components/onboarding/setup-flow";
import { useAuth } from "@/context/auth";
import { clearOnboardingDraft } from "@/lib/onboarding";

export default function OnboardingScreen() {
  return (
    <ProtectedScreen requireProfile={false}>
      <OnboardingContent />
    </ProtectedScreen>
  );
}

function OnboardingContent() {
  const { deleteAccount, profile, saveProfile, session, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const userId = session?.user.id;
  const email = session?.user.email;

  if (!userId || !email) {
    return null;
  }

  if (profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const authenticatedUserId = userId;

  const metadata = session.user.user_metadata;
  const metadataName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : [metadata.given_name, metadata.family_name]
          .filter((part): part is string => typeof part === "string")
          .join(" ");

  async function handleComplete(values: SetupProfileValues) {
    setSaving(true);
    setError(null);

    try {
      await saveProfile(values);
      clearOnboardingDraft(authenticatedUserId);
      router.replace("/(tabs)/dashboard");
    } catch (profileError) {
      setError((profileError as Error).message);
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    await signOut();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    await deleteAccount();
    clearOnboardingDraft(authenticatedUserId);
  }

  return (
    <>
      <SetupFlow
        email={email}
        initialName={metadataName}
        onComplete={handleComplete}
        onDeleteAccount={() => setDeletionOpen(true)}
        onSignOut={handleSignOut}
        saving={saving}
        serverError={error}
        userId={authenticatedUserId}
      />
      {deletionOpen ? (
        <AccountDeletionDialog
          onClose={() => setDeletionOpen(false)}
          onDelete={handleDeleteAccount}
        />
      ) : null}
    </>
  );
}
