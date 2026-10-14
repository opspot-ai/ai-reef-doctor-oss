import * as React from "react";
import { View } from "react-native";
import { Screen, SectionLabel, Title, Subtitle, Card, DisclaimerBanner } from "@/components/ui";
import { spacing } from "@/theme/tokens";
import type { IconProps } from "@/components/icons";

/**
 * Minimal, on-brand placeholder for tab screens the fan-out will replace. Renders
 * a real title + an explanatory "coming in the next build step" note so the
 * bundle is valid and the navigation skeleton is browsable today.
 */
export function PlaceholderScreen({
  label,
  title,
  description,
  Icon,
  showDisclaimer = false,
}: {
  label: string;
  title: string;
  description: string;
  Icon?: (p: IconProps) => React.ReactElement;
  showDisclaimer?: boolean;
}) {
  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <SectionLabel>{label}</SectionLabel>
        <Title>{title}</Title>
      </View>
      <Card>
        <View style={{ gap: spacing.md, alignItems: "flex-start" }}>
          {Icon ? <Icon size={28} /> : null}
          <Subtitle>{description}</Subtitle>
          <Subtitle>This screen is coming in the next build step.</Subtitle>
        </View>
      </Card>
      {showDisclaimer ? <DisclaimerBanner /> : null}
    </Screen>
  );
}
