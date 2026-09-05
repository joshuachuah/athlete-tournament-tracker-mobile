import "react-native-gesture-handler";

import { Pressable, Text, View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react-native";

import { ProjectionSheetProvider } from "@/components/tournament/projection-sheet";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { colors } from "@/constants/theme";
import { AuthProvider } from "@/context/auth";
import { queryClient } from "@/lib/query-client";

export function returnToDashboard() {
  router.dismissTo("/(tabs)/dashboard");
}

function TournamentBackButton() {
  return (
    <Pressable
      accessibilityLabel="Back to dashboard"
      accessibilityRole="button"
      hitSlop={8}
      onPress={returnToDashboard}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ChevronLeft color={colors.foreground} size={24} strokeWidth={2} />
        <Text style={{ color: colors.foreground, fontSize: 16 }}>Dashboard</Text>
      </View>
    </Pressable>
  );
}

export default function RootLayout() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectionSheetProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.foreground,
            }}
          >
            <Stack.Screen
              name="projection-sheet"
              options={{
                presentation: "formSheet",
                animation: reducedMotion ? "none" : "default",
                sheetAllowedDetents: "fitToContents",
                sheetGrabberVisible: true,
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding"
              options={{ gestureEnabled: false, headerShown: false }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="account-controls"
              options={{ headerBackTitle: "Account", title: "Account controls" }}
            />
            <Stack.Screen name="search" options={{ title: "Tournament search" }} />
            <Stack.Screen
              name="tournaments/[id]"
              options={{
                title: "Tournament",
                headerLeft: TournamentBackButton,
              }}
            />
            <Stack.Screen name="tournaments/new" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style={pathname === "/login" ? "light" : "dark"} />
        </ProjectionSheetProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
