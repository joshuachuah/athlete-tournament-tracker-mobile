import type { PropsWithChildren } from "react";
import { Redirect } from "expo-router";

import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/context/auth";

type ProtectedScreenProps = PropsWithChildren<{
  requireProfile?: boolean;
}>;

export function ProtectedScreen({
  children,
  requireProfile = true,
}: ProtectedScreenProps) {
  const { profile, session, status } = useAuth();

  if (status === "loading") {
    return <LoadingState label="Loading athlete tracker" />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (requireProfile && !profile) {
    return <Redirect href="/onboarding" />;
  }

  return children;
}
