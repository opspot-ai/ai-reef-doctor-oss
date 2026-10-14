import * as React from "react";
import { View, Text, StyleSheet, type TextStyle } from "react-native";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";

/**
 * A tiny, dependency-free markdown-ish renderer for the Reef Doctor's replies.
 *
 * The web app uses react-markdown, but we deliberately avoid any web-only dep on
 * native. This handles the formatting the model actually emits: headings (#),
 * unordered/ordered lists, blockquotes, horizontal rules, and inline **bold**,
 * *italic*, and `code`. Anything it doesn't recognize renders as plain,
 * readable text — never throwing, never dropping content.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; text: string }
  | { type: "ordered"; marker: string; text: string }
  | { type: "quote"; text: string }
  | { type: "rule" }
  | { type: "paragraph"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", text: para.join(" ").trim() });
      para = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushPara();
      continue;
    }
    // Horizontal rule
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: "rule" });
      continue;
    }
    // Heading (#, ##, ###…)
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      blocks.push({
        type: "heading",
        level: heading[1]!.length,
        text: heading[2]!,
      });
      continue;
    }
    // Ordered list item: "1. text"
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushPara();
      blocks.push({
        type: "ordered",
        marker: `${ordered[1]}.`,
        text: ordered[2]!,
      });
      continue;
    }
    // Unordered list item: "- text" / "* text" / "• text"
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushPara();
      blocks.push({ type: "bullet", text: bullet[1]! });
      continue;
    }
    // Blockquote
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushPara();
      blocks.push({ type: "quote", text: quote[1]! });
      continue;
    }
    // Otherwise accumulate into the current paragraph.
    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

/* ─────────────────── inline (**bold**, *italic*, `code`) ─────────────────── */

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string };

const INLINE_RE = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: text.slice(last, m.index) });
    }
    if (m[2] != null) tokens.push({ kind: "bold", value: m[2] });
    else if (m[3] != null) tokens.push({ kind: "bold", value: m[3] });
    else if (m[4] != null) tokens.push({ kind: "code", value: m[4] });
    else if (m[5] != null) tokens.push({ kind: "italic", value: m[5] });
    else if (m[6] != null) tokens.push({ kind: "italic", value: m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

function Inline({ text, style }: { text: string; style?: TextStyle }) {
  const tokens = React.useMemo(() => parseInline(text), [text]);
  return (
    <Text style={[styles.body, style]}>
      {tokens.map((t, i) => {
        if (t.kind === "bold") {
          return (
            <Text key={i} style={styles.bold}>
              {t.value}
            </Text>
          );
        }
        if (t.kind === "italic") {
          return (
            <Text key={i} style={styles.italic}>
              {t.value}
            </Text>
          );
        }
        if (t.kind === "code") {
          return (
            <Text key={i} style={styles.code}>
              {t.value}
            </Text>
          );
        }
        return <Text key={i}>{t.value}</Text>;
      })}
    </Text>
  );
}

/* ─────────────────────────── renderer ─────────────────────────── */

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);
  return (
    <View style={styles.root}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <Inline
                key={i}
                text={b.text}
                style={b.level <= 2 ? styles.h2 : styles.h3}
              />
            );
          case "bullet":
            return (
              <View key={i} style={styles.listRow}>
                <Text style={styles.bulletMark}>•</Text>
                <Inline text={b.text} style={styles.listText} />
              </View>
            );
          case "ordered":
            return (
              <View key={i} style={styles.listRow}>
                <Text style={styles.orderedMark}>{b.marker}</Text>
                <Inline text={b.text} style={styles.listText} />
              </View>
            );
          case "quote":
            return (
              <View key={i} style={styles.quote}>
                <Inline text={b.text} style={styles.quoteText} />
              </View>
            );
          case "rule":
            return <View key={i} style={styles.rule} />;
          default:
            return <Inline key={i} text={b.text} style={styles.paragraph} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  body: {
    color: colors.text,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  paragraph: {
    color: colors.text,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  bold: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  italic: {
    fontStyle: "italic",
    color: colors.textMuted,
  },
  code: {
    fontFamily: "Courier",
    fontSize: fontSize.sm,
    color: colors.brandSoft,
    backgroundColor: "rgba(6,26,42,0.6)",
  },
  h2: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  h3: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: 2,
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  bulletMark: {
    color: colors.brandSoft,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  orderedMark: {
    color: colors.brandSoft,
    fontSize: fontSize.base,
    lineHeight: 23,
    fontWeight: fontWeight.semibold,
    minWidth: 18,
  },
  listText: {
    flex: 1,
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(33,184,165,0.40)",
    paddingLeft: spacing.md,
  },
  quoteText: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
