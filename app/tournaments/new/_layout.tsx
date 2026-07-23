import { Pressable, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { ProtectedScreen } from "@/components/auth/protected-screen";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { TournamentDraftProvider } from "@/context/tournament-draft";

export function leaveTournamentProjection() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.dismissTo("/(tabs)/add");
}

function TournamentFormBackButton() {
  return (
    <Pressable
      accessibilityLabel="Leave tournament projection"
      accessibilityRole="button"
      hitSlop={8}
      onPress={leaveTournamentProjection}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ChevronLeft color={colors.foreground} size={24} strokeWidth={2} />
        <Text style={{ color: colors.foreground, fontSize: 16 }}>Back</Text>
      </View>
    </Pressable>
  );
}

export default function NewTournamentLayout() {
  return (
    <ProtectedScreen>
      <NewTournamentNavigator />
    </ProtectedScreen>
  );
}

function NewTournamentNavigator() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return (
    <TournamentDraftProvider key={userId ?? "signed-out"} userId={userId}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="details"
          options={{
            title: "Tournament",
            headerLeft: TournamentFormBackButton,
          }}
        />
        <Stack.Screen name="prizes" options={{ title: "Prize money" }} />
        <Stack.Screen name="travel" options={{ title: "Travel" }} />
        <Stack.Screen name="subsidy" options={{ title: "Subsidy" }} />
        <Stack.Screen name="spending" options={{ title: "Spending plan" }} />
      </Stack>
    </TournamentDraftProvider>
  );
}
