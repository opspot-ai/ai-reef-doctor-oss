import { DynamicColorIOS } from "react-native";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { palette } from "@/theme/tokens";

/**
 * Native iOS tab bar (UITabBarController) → renders Apple Liquid Glass automatically
 * on iOS 26, with scroll-to-minimize. SF Symbols + short labels keep it glanceable
 * (HIG: symbols over words). Tint uses DynamicColorIOS so it adapts light/dark and
 * survives Reduce Transparency.
 */
const tint = DynamicColorIOS({
  light: palette.lagoon[600],
  dark: palette.lagoon[300],
});

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" />
        <Label>Reef</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="doctor">
        <Icon sf="stethoscope" />
        <Label>Doctor</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diagnose">
        <Icon sf="camera.viewfinder" />
        <Label>Scan</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="parameters">
        <Icon sf="drop.fill" />
        <Label>Water</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf="person.fill" />
        <Label>You</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
