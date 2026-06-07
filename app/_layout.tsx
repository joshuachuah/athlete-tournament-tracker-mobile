import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { colors } from "@/constants/theme";
import { AuthProvider } from "@/context/auth";
import { queryClient } from "@/lib/query-client";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.foreground,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: "Athlete profile" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: "Tournament search" }} />
          <Stack.Screen name="tournaments/[id]" options={{ title: "Tournament" }} />
          <Stack.Screen name="tournaments/new" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
