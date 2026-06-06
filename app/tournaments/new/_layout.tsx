import { Stack } from "expo-router";

import { colors } from "@/constants/theme";
import { TournamentDraftProvider } from "@/context/tournament-draft";

export default function NewTournamentLayout() {
  return (
    <TournamentDraftProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ title: "Details" }} />
        <Stack.Screen name="prizes" options={{ title: "Prize money" }} />
        <Stack.Screen name="travel" options={{ title: "Travel" }} />
        <Stack.Screen name="subsidy" options={{ title: "Subsidy" }} />
        <Stack.Screen name="spending" options={{ title: "Spending plan" }} />
      </Stack>
    </TournamentDraftProvider>
  );
}
