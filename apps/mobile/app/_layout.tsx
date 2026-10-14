import * as React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme/tokens";

/**
 * Root layout: providers (safe area + auth) wrapping the navigation Stack. The
 * Stack hosts two groups — (auth) and (tabs) — with the dark ocean background
 * applied via contentStyle. Screens decide their own auth gating via useAuth().
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
