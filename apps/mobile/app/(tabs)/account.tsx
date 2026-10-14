import * as React from "react";
import { View, Text, StyleSheet, Alert, Pressable } from "react-native";
import { TIERS, type Entitlements, type SubTier } from "@reef/shared";
import {
  Screen,
  Card,
  SectionLabel,
  Title,
  Button,
  Badge,
  Spinner,
  Sym,
  GlassCTA,
  type Tone,
} from "@/components/ui";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { getSessionEntitlements, listReminders } from "@/lib/data";
import {
  getNotificationPermissions,
  requestNotificationPermissions,
  scheduleAllReminders,
  cancelAllReminders,
  type PermissionState,
} from "@/lib/notifications";
import {
  flushQueue,
  pendingCount,
  type FlushResult,
} from "@/lib/offline";
import type { SymbolViewProps } from "expo-symbols";

/**
 * Account ("You") — visual-first, Liquid Glass.
 *
 * The plan card leads with the tier name + a crown/sparkles SF Symbol + a status
 * pill; entitlement caps are big numerals; perks are a compact checkmark list.
 * Profile is a single row. Reminders is the one focal GlassCTA (requests
 * notification permission ON TAP — never auto). Sign out is a clear secondary.
 *
 * mobile purchase policy (CRITICAL): NO in-app subscribe and NO link/CTA to a purchase page.
 * Membership is a neutral one-liner ("managed on your account"), not a steer.
 */

interface AccountData {
  entitlements: Entitlements;
}

export default function AccountScreen() {
  const { user, isDemo, signOut } = useAuth();
  const [data, setData] = React.useState<AccountData | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const entitlements = await getSessionEntitlements();
      if (active) setData({ entitlements });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Spinner />
      </Screen>
    );
  }

  const { entitlements } = data;
  const tier = TIERS[entitlements.tier];
  const status = statusMeta(entitlements);
  const tierSymbol = tierIcon(entitlements.tier);

  const displayName = (user?.full_name || "").trim() || "Reefer";
  const email = user?.email || "No email on file";

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <SectionLabel>You</SectionLabel>
        <Title>Account</Title>
      </View>

      {/* Profile row */}
      <Card>
        <View style={styles.profileRow}>
          <Sym name="person.crop.circle.fill" size={44} color={colors.brandSoft} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          </View>
          {isDemo ? (
            <Badge tone="brand">
              <View style={styles.iconBadgeRow}>
                <Sym name="sparkles" size={12} color={colors.text} />
                <Text style={[styles.badgeLabel, { color: colors.text }]}>
                  Demo
                </Text>
              </View>
            </Badge>
          ) : null}
        </View>
      </Card>

      {/* Plan card — big tier name + symbol + status pill + caps + perks */}
      <Card>
        <View style={styles.planHeader}>
          <Sym name={tierSymbol} size={32} color={colors.brandSoft} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.planName} numberOfLines={1}>
              {tier.name}
            </Text>
          </View>
          <Badge tone={status.tone}>
            <View style={styles.iconBadgeRow}>
              <Sym name={status.symbol} size={12} color={statusIconColor(status.tone)} />
              <Text style={[styles.badgeLabel, { color: statusIconColor(status.tone) }]}>
                {status.label}
              </Text>
            </View>
          </Badge>
        </View>

        {/* Caps as big numerals */}
        <View style={styles.capRow}>
          <CapCell symbol="cube.box.fill" value={capLabel(entitlements.maxTanks)} label="Tanks" />
          <View style={styles.capDivider} />
          <CapCell symbol="bubble.left.and.bubble.right.fill" value={capLabel(entitlements.aiChatsPerMonth)} label="Chats / mo" />
          <View style={styles.capDivider} />
          <CapCell symbol="camera.viewfinder" value={capLabel(entitlements.photoDiagnosesPerMonth)} label="Scans / mo" />
        </View>

        {/* Perks — compact checkmark list */}
        <View style={styles.featureList}>
          {tier.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Sym name="checkmark.seal.fill" size={16} color={colors.brandSoft} />
              <Text style={styles.featureText} numberOfLines={1}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {/* mobile purchase policy: neutral membership note — NO purchase CTA/link. */}
        <View style={styles.membershipNote}>
          <Sym name="info.circle.fill" size={14} color={colors.textMuted} />
          <Text style={styles.membershipText}>
            Membership is managed on your account.
          </Text>
        </View>
      </Card>

      {/* Reminders — the focal GlassCTA */}
      <RemindersCard isDemo={isDemo} />

      {/* Offline sync — compact */}
      <OfflineSyncCard isDemo={isDemo} />

      {/* Sign out — clear secondary */}
      <Button
        variant="secondary"
        disabled={isDemo}
        onPress={() => {
          void signOut();
        }}
      >
        <View style={styles.signOutRow}>
          <Sym name="rectangle.portrait.and.arrow.right" size={16} color={colors.text} />
          <Text style={styles.signOutText}>
            {isDemo ? "Sign out (demo)" : "Sign out"}
          </Text>
        </View>
      </Button>

      {/* Danger zone — permanent, in-app account deletion (App Store 5.1.1(v)) */}
      <DeleteAccount isDemo={isDemo} onDeleted={() => void signOut()} />
    </Screen>
  );
}

/* ─────────────────────────── delete account ─────────────────────────── */

function DeleteAccount({
  isDemo,
  onDeleted,
}: {
  isDemo: boolean;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  function confirmDelete() {
    if (isDemo) {
      Alert.alert(
        "Account management unavailable",
        "You're in demo mode. Connect a real account to permanently delete it.",
      );
      return;
    }
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete() },
      ],
    );
  }

  async function runDelete() {
    setBusy(true);
    try {
      await api.deleteAccount();
      Alert.alert(
        "Account deleted",
        "Your account and all data have been permanently removed.",
      );
      onDeleted();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "We couldn't delete your account just now. Please try again.";
      Alert.alert("Couldn't delete account", message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.dangerZone}>
      <Pressable
        onPress={confirmDelete}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={({ pressed }) => [
          styles.deleteBtn,
          pressed && styles.deletePressed,
          busy && styles.deleteDisabled,
        ]}
      >
        <Sym name="trash.fill" size={16} color={colors.dangerText} />
        <Text style={styles.deleteText}>
          {busy ? "Deleting…" : "Delete account"}
        </Text>
      </Pressable>
      <View style={styles.deleteNote}>
        <Sym name="info.circle.fill" size={13} color={colors.textFaint} />
        <Text style={styles.deleteNoteText}>
          An active web subscription must be cancelled separately.
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────────────── cap cell ─────────────────────────── */

function CapCell({
  symbol,
  value,
  label,
}: {
  symbol: SymbolViewProps["name"];
  value: string;
  label: string;
}) {
  const big = value.length <= 3;
  return (
    <View style={styles.capCell}>
      <Sym name={symbol} size={18} color={colors.brandSoft} />
      <Text style={[styles.capValue, !big && styles.capValueSmall]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.capLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ─────────────────────────── reminders card ─────────────────────────── */

function RemindersCard({ isDemo }: { isDemo: boolean }) {
  const [permission, setPermission] = React.useState<PermissionState | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [scheduledCount, setScheduledCount] = React.useState<number | null>(
    null,
  );

  React.useEffect(() => {
    let active = true;
    void getNotificationPermissions().then((p) => {
      if (active) setPermission(p);
    });
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const next = await requestNotificationPermissions();
      setPermission(next);
      if (next === "granted") {
        const reminders = await listReminders();
        const count = await scheduleAllReminders(reminders);
        setScheduledCount(count);
      } else if (next === "denied") {
        Alert.alert(
          "Notifications are off",
          "Enable notifications for AI Reef Doctor in your device Settings to get reminder alerts.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await cancelAllReminders();
      setScheduledCount(0);
    } finally {
      setBusy(false);
    }
  }

  const granted = permission === "granted";
  const denied = permission === "denied";

  return (
    <Card>
      <View style={styles.cardTopRow}>
        <View style={styles.iconHeading}>
          <Sym name="bell.fill" size={20} color={colors.brandSoft} />
          <Text style={styles.cardHeading}>Reminders</Text>
        </View>
        {granted ? (
          <Badge tone="healthy">
            <View style={styles.iconBadgeRow}>
              <Sym name="checkmark.circle.fill" size={12} color={colors.healthyText} />
              <Text style={[styles.badgeLabel, { color: colors.healthyText }]}>
                {scheduledCount !== null && scheduledCount > 0
                  ? `${scheduledCount} set`
                  : "On"}
              </Text>
            </View>
          </Badge>
        ) : denied ? (
          <Badge tone="caution">
            <View style={styles.iconBadgeRow}>
              <Sym name="bell.slash.fill" size={12} color={colors.cautionText} />
              <Text style={[styles.badgeLabel, { color: colors.cautionText }]}>
                Blocked
              </Text>
            </View>
          </Badge>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        {granted ? (
          <Button variant="secondary" disabled={busy} onPress={() => void turnOff()}>
            {busy ? "Working…" : "Turn off"}
          </Button>
        ) : (
          <GlassCTA
            label={busy ? "Requesting…" : "Enable reminders"}
            symbol="bell.fill"
            tone="brand"
            disabled={busy}
            onPress={() => void enable()}
          />
        )}
      </View>

      {denied ? (
        <View style={styles.inlineNote}>
          <Sym name="gearshape.fill" size={13} color={colors.cautionText} />
          <Text style={[styles.inlineNoteText, { color: colors.cautionText }]}>
            Turn on in device Settings
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/* ─────────────────────────── offline sync card ─────────────────────────── */

function OfflineSyncCard({ isDemo }: { isDemo: boolean }) {
  const [pending, setPending] = React.useState<number>(0);
  const [busy, setBusy] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<FlushResult | null>(null);

  React.useEffect(() => {
    let active = true;
    void pendingCount().then((n) => {
      if (active) setPending(n);
    });
    return () => {
      active = false;
    };
  }, []);

  async function sync() {
    setBusy(true);
    try {
      const result = await flushQueue();
      setLastResult(result);
      setPending(await pendingCount());
    } finally {
      setBusy(false);
    }
  }

  const clear = pending === 0;

  return (
    <Card>
      <View style={styles.cardTopRow}>
        <View style={styles.iconHeading}>
          <Sym name="arrow.triangle.2.circlepath" size={20} color={colors.brandSoft} />
          <Text style={styles.cardHeading}>Logbook sync</Text>
        </View>
        <Badge tone={clear ? "healthy" : "caution"}>
          <View style={styles.iconBadgeRow}>
            <Sym
              name={clear ? "checkmark.icloud.fill" : "icloud.and.arrow.up.fill"}
              size={12}
              color={clear ? colors.healthyText : colors.cautionText}
            />
            <Text
              style={[
                styles.badgeLabel,
                { color: clear ? colors.healthyText : colors.cautionText },
              ]}
            >
              {clear ? "Synced" : `${pending} queued`}
            </Text>
          </View>
        </Badge>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Button
          variant="secondary"
          disabled={busy || clear}
          onPress={() => void sync()}
        >
          {busy ? "Syncing…" : "Sync now"}
        </Button>
      </View>

      {lastResult ? (
        <View style={styles.inlineNote}>
          <Sym
            name={lastResult.skipped ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"}
            size={13}
            color={lastResult.skipped ? colors.cautionText : colors.brandSoft}
          />
          <Text style={styles.inlineNoteText}>
            {lastResult.skipped
              ? isDemo
                ? "Cleared locally"
                : "Will retry"
              : `Synced ${lastResult.flushed}`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

interface StatusMeta {
  label: string;
  tone: Tone;
  symbol: SymbolViewProps["name"];
}

function statusMeta(ent: Entitlements): StatusMeta {
  if (ent.tier === "free") {
    return { label: "Free", tone: "neutral", symbol: "checkmark.circle.fill" };
  }
  if (ent.active) {
    return { label: "Active", tone: "healthy", symbol: "checkmark.seal.fill" };
  }
  return { label: "Inactive", tone: "caution", symbol: "exclamationmark.triangle.fill" };
}

function tierIcon(tier: SubTier): SymbolViewProps["name"] {
  switch (tier) {
    case "premium":
      return "crown.fill";
    case "pro":
      return "sparkles";
    default:
      return "drop.fill";
  }
}

function statusIconColor(tone: Tone): string {
  switch (tone) {
    case "healthy":
      return colors.healthyText;
    case "caution":
      return colors.cautionText;
    case "danger":
      return colors.dangerText;
    default:
      return colors.text;
  }
}

/** Infinity → "∞", else the number. */
function capLabel(n: number): string {
  return Number.isFinite(n) ? String(n) : "∞";
}

// Keep SubTier referenced for future tier-specific UI.
const TIER_ORDER: SubTier[] = ["free", "pro", "premium"];
void TIER_ORDER;

/* ─────────────────────────── styles ─────────────────────────── */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  email: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  planName: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  iconBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  capRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
  },
  capCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  capDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: spacing.xs,
    backgroundColor: colors.borderSubtle,
  },
  capValue: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  capValueSmall: {
    fontSize: fontSize.lg,
  },
  capLabel: {
    fontSize: 11,
    color: colors.textFaint,
    fontWeight: fontWeight.medium,
  },
  featureList: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: "rgba(212,233,244,0.88)",
  },
  membershipNote: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.lg,
  },
  membershipText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  iconHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardHeading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  inlineNote: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineNoteText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  signOutText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dangerZone: {
    gap: spacing.sm,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,106,66,0.30)",
    backgroundColor: "rgba(251,77,36,0.10)",
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteDisabled: {
    opacity: 0.5,
  },
  deleteText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.dangerText,
  },
  deleteNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  deleteNoteText: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: "center",
  },
});
