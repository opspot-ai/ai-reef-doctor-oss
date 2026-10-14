import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radii, fontSize } from "@/theme/tokens";
import { Glass } from "@/components/glass";
import { Sym } from "@/components/ui";
import { ChatMarkdown } from "@/components/chat-markdown";

/* ─────────────────────────── types ─────────────────────────── */

export type ChatRole = "user" | "assistant";

export interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** True while this assistant message is still being streamed in. */
  streaming?: boolean;
  /** True when this assistant turn failed (renders an error bubble). */
  error?: boolean;
}

/* ─────────────────────────── bubble ─────────────────────────── */

/**
 * A single chat row. User turns are right-aligned solid brand bubbles; the
 * Doctor's turns are left-aligned Liquid Glass with a small Stethoscope Sym
 * avatar, markdown render, a "thinking" indicator while empty, and a coral
 * error variant on failure.
 */
export function ChatBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View
        style={styles.userRow}
        accessibilityRole="text"
        accessibilityLabel={`You said: ${message.content}`}
      >
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.doctorRow}>
      <View
        style={styles.avatar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Sym name="stethoscope" size={18} color={colors.textOnAccent} />
      </View>
      <View style={styles.doctorBody}>
        {message.error ? (
          <View
            style={styles.errorBubble}
            accessibilityRole="text"
            accessibilityLabel={`Reef Doctor error: ${message.content}`}
          >
            <Sym
              name="exclamationmark.triangle.fill"
              size={16}
              color={colors.dangerText}
            />
            <Text style={styles.errorText}>{message.content}</Text>
          </View>
        ) : (
          <Glass
            variant="regular"
            fallbackColor={colors.cardElevated}
            style={styles.doctorBubble}
            accessibilityRole="text"
            accessibilityLabel={
              message.content
                ? `Reef Doctor: ${message.content}`
                : "Reef Doctor is thinking"
            }
          >
            {message.content ? (
              <ChatMarkdown content={message.content} />
            ) : (
              <TypingIndicator />
            )}
          </Glass>
        )}
      </View>
    </View>
  );
}

/** Three bouncing dots while we wait for the first token. */
function TypingIndicator() {
  return (
    <View
      style={styles.typingRow}
      accessibilityRole="text"
      accessibilityLabel="The Doctor is thinking"
    >
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */

const styles = StyleSheet.create({
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.brand,
    borderRadius: radii.xl,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  userText: {
    color: colors.textOnAccent,
    fontSize: fontSize.base,
    lineHeight: 22,
    fontWeight: "600",
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    marginTop: 2,
  },
  doctorBody: {
    flex: 1,
    minWidth: 0,
  },
  doctorBubble: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: radii.xl,
    borderTopLeftRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  errorBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(251,77,36,0.10)",
    borderColor: "rgba(255,106,66,0.30)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xl,
    borderTopLeftRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.dangerText,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  dots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.brandSoft,
  },
});
