import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { Screen, Title, Subtitle } from "@/components/ui";
import { colors, spacing, fontSize, fontWeight } from "@/theme/tokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Title>This page doesn&apos;t exist.</Title>
          <Subtitle>The reef took a wrong turn.</Subtitle>
          <Link href="/(tabs)" style={styles.link}>
            Go to the dashboard
          </Link>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.brandSoft,
    marginTop: spacing.sm,
  },
});
