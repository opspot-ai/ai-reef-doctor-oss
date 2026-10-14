import * as React from "react";
import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

/** Auth group: stacked sign-in / sign-up screens with no header chrome. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
