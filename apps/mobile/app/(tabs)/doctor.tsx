import * as React from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ChatMessage, Tank } from "@reef/shared";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { DisclaimerBanner, Sym } from "@/components/ui";
import { ChatBubble, type UiMessage } from "@/components/chat-bubble";
import { ChatComposer } from "@/components/chat-composer";
import { ChatEmpty } from "@/components/chat-empty";
import { useAuth } from "@/lib/auth";
import { getActiveTank } from "@/lib/data";
import { TANK_TYPE_LABEL } from "@/lib/format";
import { streamChat, fetchChatOnce } from "@/lib/chat-stream";

/**
 * Reef Doctor chat tab  — a native streaming chat with the AI doctor.
 *
 * Liquid Glass + visual-first: glass doctor bubbles, a glass composer with a
 * circular glass send, a glass emergency pill, and a Sym-driven empty state.
 * Behavior is unchanged — SSE streaming with a buffered fallback, a graceful
 * "unavailable" bubble, and a persistent (compact) medical disclaimer.
 */

const EMERGENCY_PROMPT =
  "My tank is crashing. Walk me through emergency triage right now — what " +
  "should I check first, what's safe to do immediately, and how do I " +
  "stabilize livestock while I get my parameters under control?";

const ERROR_BUBBLE =
  "The Doctor is unavailable right now. This can happen if the AI service " +
  "isn't configured or is temporarily down. Please try again in a moment.";

const DEMO_BUBBLE =
  "The Doctor is unavailable in demo mode — live AI chat needs a connected " +
  "account. You can still explore the rest of the app with the demo reef, and " +
  "ask me anything once you're signed in to a real account.";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}-${Date.now().toString(36)}`;
}

export default function DoctorScreen() {
  const { isDemo, isAuthenticated } = useAuth();
  const [tank, setTank] = React.useState<Tank | null>(null);
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);

  const listRef = React.useRef<FlatList<UiMessage>>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  /* Resolve the active tank for context-aware answers. */
  React.useEffect(() => {
    let active = true;
    (async () => {
      const t = await getActiveTank();
      if (active) setTank(t);
    })();
    return () => {
      active = false;
    };
  }, []);

  /* Cancel any in-flight stream on unmount. */
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToEnd = React.useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: UiMessage = {
        id: nextId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = nextId();
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      // Wire payload = the conversation so far + this user turn.
      const history: ChatMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);
      scrollToEnd();

      const patchAssistant = (patch: Partial<UiMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
        );

      const appendDelta = (delta: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + delta } : m,
          ),
        );

      const fail = (msg: string) =>
        patchAssistant({ content: msg, streaming: false, error: true });

      // Demo mode (or signed out) cannot reach authenticated AI — fail kindly.
      if (isDemo || !isAuthenticated) {
        fail(DEMO_BUBBLE);
        setStreaming(false);
        scrollToEnd();
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      let sawText = false;
      const callbacks = {
        onText: (delta: string) => {
          sawText = true;
          appendDelta(delta);
          scrollToEnd();
        },
        onError: (m: string) => {
          patchAssistant({
            content: m || ERROR_BUBBLE,
            streaming: false,
            error: true,
          });
        },
        onDone: () => {
          patchAssistant({ streaming: false });
        },
      };

      try {
        const req = {
          tankId: tank?.id,
          messages: history,
          signal: controller.signal,
        };

        let result = await streamChat(req, callbacks);

        // Streaming produced nothing usable → try the buffered fallback once.
        if (!result.ok && !result.aborted && !sawText) {
          result = await fetchChatOnce(req, callbacks);
        }

        if (result.aborted) {
          patchAssistant({ streaming: false });
        } else if (!result.ok && !sawText) {
          fail(ERROR_BUBBLE);
        } else {
          patchAssistant({ streaming: false });
        }
      } catch {
        fail(ERROR_BUBBLE);
      } finally {
        setStreaming(false);
        abortRef.current = null;
        scrollToEnd();
      }
    },
    [messages, streaming, tank, isDemo, isAuthenticated, scrollToEnd],
  );

  const onEmergency = React.useCallback(() => {
    void send(EMERGENCY_PROMPT);
  }, [send]);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, []);

  const hasMessages = messages.length > 0;
  const tankSub = tank
    ? `${tank.name} · ${TANK_TYPE_LABEL[tank.type] ?? tank.type}`
    : null;

  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<UiMessage>) => <ChatBubble message={item} />,
    [],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Header: Sym title + active-tank context chip */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <Sym name="stethoscope" size={20} color={colors.textOnAccent} />
            </View>
            <Text style={styles.title}>Reef Doctor</Text>
          </View>
          {tankSub ? (
            <View style={styles.tankChip}>
              <Sym name="drop.fill" size={13} color={colors.brandSoft} />
              <Text style={styles.tankChipText} numberOfLines={1}>
                {tankSub}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Conversation */}
        <View style={styles.flex}>
          {hasMessages ? (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
              accessibilityLabel="Conversation with the Reef Doctor"
            />
          ) : (
            <FlatList
              data={[]}
              renderItem={null}
              keyExtractor={() => "empty"}
              contentContainerStyle={styles.emptyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <ChatEmpty
                  activeTankName={tank?.name ?? null}
                  onPick={(p) => void send(p)}
                  disabled={streaming}
                />
              }
            />
          )}
        </View>

        {/* Persistent trust signal (compact) */}
        <View style={styles.disclaimerWrap}>
          <DisclaimerBanner
            text="General guidance — verify critical actions with a pro."
            style={styles.disclaimer}
          />
        </View>

        {/* Composer */}
        <ChatComposer
          value={input}
          onChangeText={setInput}
          onSend={() => void send(input)}
          onEmergency={onEmergency}
          onReset={reset}
          streaming={streaming}
          showReset={hasMessages}
          disabledReason={
            isDemo || !isAuthenticated
              ? "Live chat needs a connected account"
              : undefined
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  tankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(61,141,189,0.15)",
  },
  tankChipText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  disclaimerWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  disclaimer: {
    paddingVertical: 7,
  },
});
