import { Redirect } from "expo-router";

import { ProtectedScreen } from "@/components/auth/protected-screen";

export default function IndexRoute() {
  return (
    <ProtectedScreen>
      <Redirect href="/(tabs)/dashboard" />
    </ProtectedScreen>
  );
}
