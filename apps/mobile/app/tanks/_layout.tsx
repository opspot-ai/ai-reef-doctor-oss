import * as React from "react";
import { Stack } from "expo-router";
import { colors, fontWeight } from "@/theme/tokens";

/**
 * Tanks stack — the logbook list and per-tank detail pushed over the tab UI.
 * On-brand dark ocean header with a native back button.
 */
export default function TanksLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.backgroundAlt },
        headerTintColor: colors.brandSoft,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: fontWeight.semibold,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Tanks" }} />
      <Stack.Screen name="[id]" options={{ title: "Tank" }} />
    </Stack>
  );
}
