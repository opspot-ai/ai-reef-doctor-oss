import * as React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, radii, fontSize } from "@/theme/tokens";
import { Glass } from "@/components/glass";
import { Sym, Spinner } from "@/components/ui";

/**
 * The chat composer: a prominent glass "tank is crashing" emergency pill, an
 * optional reset, and a glass input bar pinned to the bottom with a circular
 * glass send button (SF Symbol arrow.up). Sending is disabled while a reply is
 * streaming or when the input is empty.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onEmergency,
  onReset,
  streaming,
  showReset,
  disabledReason,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onEmergency: () => void;
  onReset: () => void;
  streaming: boolean;
  showReset: boolean;
  /** When set, sending is blocked (e.g. AI unavailable) and this is shown. */
  disabledReason?: string;
}) {
  const canSend = !streaming && value.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => {},
            );
            onEmergency();
          }}
          disabled={streaming}
          style={({ pressed }) => [
            styles.emergencyWrap,
            pressed && styles.pressed,
            streaming && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="My tank is crashing — start emergency triage"
        >
          <Glass
            variant="regular"
            interactive
            tintColor={colors.accent}
            fallbackColor={colors.accent}
            style={styles.emergencyPill}
          >
            <Sym
              name="exclamationmark.triangle.fill"
              size={16}
              color={colors.text}
            />
            <Text style={styles.emergencyText}>Tank crashing</Text>
          </Glass>
        </Pressable>

        {showReset ? (
          <Pressable
            onPress={onReset}
            disabled={streaming}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && styles.pressed,
              streaming && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            hitSlop={8}
          >
            <Sym
              name="square.and.pencil"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      <Glass
        variant="regular"
        fallbackColor={colors.cardElevated}
        style={styles.inputBar}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={
            streaming ? "Replying…" : "Describe what you're seeing…"
          }
          placeholderTextColor={colors.textFaint}
          multiline
          editable={!streaming}
          accessibilityLabel="Message the Reef Doctor"
          submitBehavior="newline"
        />
        <Pressable
          onPress={() => {
            if (!canSend) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            onSend();
          }}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendWrap,
            pressed && canSend && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Glass
            variant="regular"
            interactive={canSend}
            tintColor={canSend ? colors.brand : undefined}
            fallbackColor={canSend ? colors.brand : colors.cardElevated}
            style={[styles.sendBtn, !canSend && styles.sendDisabled]}
          >
            {streaming ? (
              <Spinner color={colors.textOnAccent} />
            ) : (
              <Sym
                name="arrow.up"
                size={20}
                color={canSend ? colors.textOnAccent : colors.textFaint}
                weight="bold"
              />
            )}
          </Glass>
        </Pressable>
      </Glass>

      {disabledReason ? (
        <View style={styles.notice} accessibilityRole="text">
          <Sym name="info.circle" size={13} color={colors.cautionText} />
          <Text style={styles.noticeLabel} numberOfLines={2}>
            {disabledReason}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  emergencyWrap: {
    borderRadius: radii.full,
  },
  emergencyPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    minHeight: 40,
    overflow: "hidden",
  },
  emergencyText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  resetBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderRadius: radii["2xl"],
    padding: 6,
    paddingLeft: spacing.md,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    color: colors.text,
    fontSize: fontSize.base,
    lineHeight: 22,
    paddingVertical: spacing.sm,
  },
  sendWrap: {
    borderRadius: radii.full,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sendDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  noticeLabel: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.cautionText,
    textAlign: "center",
  },
});
