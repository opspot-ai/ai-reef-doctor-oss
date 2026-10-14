import * as React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  type DiagnosisResult,
  type DiagnosisCondition,
  type DiagKind,
  type Tank,
} from "@reef/shared";
import {
  Screen,
  Card,
  SectionLabel,
  Title,
  Button,
  Badge,
  ConfidenceBadge,
  UrgencyBadge,
  DisclaimerBanner,
  SourceList,
  EmptyState,
  Spinner,
  Sym,
  GlassCTA,
  type Tone,
} from "@/components/ui";
import { Glass, GlassGroup } from "@/components/glass";
import { StethoscopeIcon } from "@/components/icons";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  getActiveTank,
  listDiagnoses,
  type DiagnosisRow,
} from "@/lib/data";
import { fmtDate } from "@/lib/format";
import type { SymbolViewProps } from "expo-symbols";

/**
 * Photo Diagnosis (Scan) — Liquid Glass, visual-first.
 * Behavior preserved: pick a subject kind (fish / coral / algae), capture or
 * choose a photo, optional note, POST to /api/ai/diagnose via the shared typed
 * client, then render the structured DiagnosisResult with every trust signal
 * (confidence, severity, evidence, urgency, dose cautions, sources, disclaimer)
 * and list the tank's recent diagnoses. Demo / AI-unavailable degrade gracefully.
 *
 * Per mobile purchase policy there is NO in-app subscribe and NO external-purchase link.
 */

/* ─────────────────────────── constants ─────────────────────────── */

type Kind = Extract<DiagKind, "fish" | "coral" | "algae">;

const KINDS: { id: Kind; label: string; symbol: SymbolViewProps["name"] }[] = [
  { id: "fish", label: "Fish", symbol: "fish.fill" },
  { id: "coral", label: "Coral", symbol: "leaf.fill" },
  { id: "algae", label: "Algae", symbol: "drop.triangle.fill" },
];

const SEVERITY: Record<
  string,
  { tone: Tone; label: string; symbol: SymbolViewProps["name"] }
> = {
  low: { tone: "healthy", label: "Low", symbol: "checkmark.seal.fill" },
  moderate: {
    tone: "caution",
    label: "Moderate",
    symbol: "exclamationmark.circle.fill",
  },
  high: {
    tone: "danger",
    label: "High",
    symbol: "exclamationmark.triangle.fill",
  },
  critical: {
    tone: "danger",
    label: "Critical",
    symbol: "exclamationmark.octagon.fill",
  },
};

const TONE_COLOR: Record<Tone, string> = {
  neutral: colors.text,
  healthy: colors.healthy,
  caution: colors.caution,
  danger: colors.danger,
  brand: colors.brand,
};
const TONE_TEXT_COLOR: Record<Tone, string> = {
  neutral: colors.text,
  healthy: colors.healthyText,
  caution: colors.cautionText,
  danger: colors.dangerText,
  brand: colors.text,
};

type Status = "idle" | "loading" | "done" | "error";

interface PickedImage {
  /** Base64 payload without the `data:...;base64,` prefix. */
  base64: string;
  /** Local URI for the preview thumbnail. */
  uri: string;
}

/* ─────────────────────────── screen ─────────────────────────── */

export default function DiagnoseScreen() {
  const { isDemo } = useAuth();

  const [tank, setTank] = React.useState<Tank | null>(null);
  const [recent, setRecent] = React.useState<DiagnosisRow[]>([]);
  const [loadingTank, setLoadingTank] = React.useState(true);

  const [kind, setKind] = React.useState<Kind>("fish");
  const [image, setImage] = React.useState<PickedImage | null>(null);
  const [note, setNote] = React.useState("");

  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<DiagnosisResult | null>(null);

  const refresh = React.useCallback(async () => {
    const active = await getActiveTank();
    const diagnoses = active ? await listDiagnoses(active.id) : [];
    return { active, diagnoses };
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { active, diagnoses } = await refresh();
      if (!alive) return;
      setTank(active);
      setRecent(diagnoses);
      setLoadingTank(false);
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const loading = status === "loading";

  /* ── image picking ── */

  function applyPick(res: ImagePicker.ImagePickerResult) {
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.base64) {
      setError("Couldn't read that photo. Try another.");
      return;
    }
    setError(null);
    setImage({ base64: asset.base64, uri: asset.uri });
  }

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in Settings to photograph your fish, coral, or algae for diagnosis.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    try {
      const res = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
      });
      applyPick(res);
    } catch {
      setError("The camera couldn't open. Please try again.");
    }
  }

  async function chooseFromLibrary() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access in Settings to pick a tank photo for diagnosis.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.6,
        mediaTypes: "images",
      });
      applyPick(res);
    } catch {
      setError("Couldn't open your photo library. Please try again.");
    }
  }

  function clearImage() {
    Haptics.selectionAsync().catch(() => {});
    setImage(null);
  }

  function selectKind(k: Kind) {
    if (k === kind) return;
    Haptics.selectionAsync().catch(() => {});
    setKind(k);
  }

  /* ── diagnose ── */

  async function runDiagnose() {
    if (!image) {
      setError("Add a photo to diagnose.");
      return;
    }
    setStatus("loading");
    setError(null);
    setNotice(null);
    setResult(null);

    // Demo mode has no live AI backend — surface a friendly notice up front.
    if (isDemo) {
      setNotice(
        "Demo mode — connect a backend + AI key for live diagnosis. Browse the demo results below.",
      );
      setStatus("idle");
      return;
    }

    try {
      const data = await api.diagnose({
        tankId: tank?.id,
        kind,
        imageBase64: image.base64,
        imageMediaType: "image/jpeg",
        note: note.trim() || undefined,
      });
      setResult(data);
      setStatus("done");
      // Refresh the recent list so the new diagnosis appears.
      const { diagnoses } = await refresh();
      setRecent(diagnoses);
    } catch (e) {
      handleDiagnoseError(e);
    }
  }

  function handleDiagnoseError(e: unknown) {
    if (e instanceof ApiError) {
      // 401 → not signed in / no live session: treat like demo.
      if (e.status === 401) {
        setNotice(
          "Sign in with an account that has photo diagnosis to run a live diagnosis.",
        );
        setStatus("idle");
        return;
      }
      // 402 → allowance reached. Per mobile purchase policy keep this account-based with NO
      // purchase CTA or external link.
      if (e.status === 402) {
        setNotice(
          "Photo diagnosis allowance reached. Access is managed on your account — it resets with your plan.",
        );
        setStatus("idle");
        return;
      }
    }
    setError(
      "We couldn't complete the diagnosis right now. The AI service may be unavailable — try again shortly.",
    );
    setStatus("error");
  }

  /* ── render ── */

  return (
    <Screen>
      {/* header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SectionLabel>Scan</SectionLabel>
          <Title>Photo diagnosis</Title>
        </View>
        {isDemo ? <Badge tone="brand">Demo</Badge> : null}
      </View>

      {tank ? (
        <View style={styles.tankChip}>
          <Sym name="drop.fill" size={14} color={colors.brandSoft} />
          <Text style={styles.tankChipText} numberOfLines={1}>
            {tank.name}
          </Text>
        </View>
      ) : null}

      {/* kind picker — 3 big glass tiles */}
      <GlassGroup spacing={spacing.sm} style={styles.kindGrid}>
        {KINDS.map((k) => {
          const selected = kind === k.id;
          return (
            <Pressable
              key={k.id}
              onPress={() => selectKind(k.id)}
              disabled={loading}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: loading }}
              accessibilityLabel={k.label}
              style={styles.kindPressable}
            >
              <Glass
                variant="regular"
                interactive
                tintColor={selected ? colors.brand : undefined}
                fallbackColor={
                  selected ? "rgba(15,156,139,0.18)" : colors.cardElevated
                }
                style={[styles.kindTile, selected && styles.kindTileSelected]}
              >
                <Sym
                  name={k.symbol}
                  size={30}
                  color={selected ? colors.text : colors.brandSoft}
                />
                <Text
                  style={[
                    styles.kindLabel,
                    selected && styles.kindLabelSelected,
                  ]}
                >
                  {k.label}
                </Text>
              </Glass>
            </Pressable>
          );
        })}
      </GlassGroup>

      {/* photo preview / placeholder */}
      {image ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: image.uri }}
            style={styles.preview}
            accessibilityLabel={`Selected ${kind} photo for diagnosis`}
            resizeMode="cover"
          />
          <Pressable
            onPress={clearImage}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            style={styles.removeBtn}
          >
            <Sym name="xmark" size={15} color={colors.text} />
          </Pressable>
        </View>
      ) : (
        <Glass
          variant="regular"
          fallbackColor={colors.cardElevated}
          style={styles.dropzone}
        >
          <Sym name="camera.viewfinder" size={40} color={colors.brandSoft} />
          <Text style={styles.dropTitle}>Add a photo</Text>
          <Text style={styles.dropHint}>Sharp · close · well-lit</Text>
        </Glass>
      )}

      {/* capture actions — one focal GlassCTA + a secondary choose */}
      <View style={styles.captureRow}>
        <GlassCTA
          label={image ? "Retake" : "Take photo"}
          symbol="camera.viewfinder"
          tone="brand"
          onPress={() => void takePhoto()}
          disabled={loading}
          style={styles.captureCta}
        />
        <Button
          variant="secondary"
          onPress={() => void chooseFromLibrary()}
          disabled={loading}
          style={styles.chooseBtn}
        >
          <View style={styles.chooseInner}>
            <Sym name="photo.on.rectangle" size={18} color={colors.text} />
            <Text style={styles.chooseText}>Choose</Text>
          </View>
        </Button>
      </View>

      {/* optional note — compact */}
      <TextInput
        value={note}
        onChangeText={setNote}
        editable={!loading}
        multiline
        maxLength={2000}
        placeholder="Add a note (optional) — onset, behavior, changes…"
        placeholderTextColor={colors.textFaint}
        style={styles.noteInput}
        accessibilityLabel="Diagnosis note"
      />

      {/* inline messages */}
      {error ? (
        <View style={styles.alertError} accessibilityRole="alert">
          <Sym
            name="exclamationmark.triangle.fill"
            size={16}
            color={colors.dangerText}
          />
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={styles.alertNotice} accessibilityRole="summary">
          <Sym name="info.circle.fill" size={16} color={colors.cautionText} />
          <Text style={styles.alertNoticeText}>{notice}</Text>
        </View>
      ) : null}

      {/* focal action — diagnose */}
      <GlassCTA
        label={loading ? "Diagnosing…" : "Diagnose"}
        symbol={loading ? undefined : "stethoscope"}
        tone="accent"
        onPress={() => void runDiagnose()}
        disabled={loading || !image}
      />

      {/* result */}
      {loading ? <LoadingResult /> : null}
      {status === "done" && result ? <ResultView result={result} /> : null}

      {/* recent diagnoses */}
      <RecentCard diagnoses={recent} loading={loadingTank} />

      <DisclaimerBanner />
    </Screen>
  );
}

/* ─────────────────────────── loading skeleton ─────────────────────────── */

function LoadingResult() {
  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={styles.loadingRow}>
        <Spinner />
        <Text style={styles.loadingText}>Reading photo…</Text>
      </View>
      <View style={styles.skeletonWrap}>
        <View style={[styles.skeletonLine, { width: "60%" }]} />
        <View style={[styles.skeletonLine, { width: "100%" }]} />
        <View style={styles.skeletonBlock} />
      </View>
    </Card>
  );
}

/* ─────────────────────────── result view ─────────────────────────── */

function ResultView({ result }: { result: DiagnosisResult }) {
  const conditions = result.conditions ?? [];
  const hasConditions = conditions.length > 0;
  const top = conditions[0];
  const rest = conditions.slice(1);
  const doseWarnings = result.doseWarnings ?? [];

  return (
    <View style={{ gap: spacing.lg }}>
      {/* top condition — big name + confidence ring + urgency */}
      {hasConditions && top ? (
        <TopConditionCard condition={top} urgency={result.urgency} />
      ) : (
        <Card>
          <EmptyState
            title="No clear match"
            description="Try a sharper, close-up photo or add a note."
          />
        </Card>
      )}

      {/* dose cautions — coral glass warning */}
      {doseWarnings.length > 0 ? (
        <Glass
          variant="regular"
          tintColor={colors.accent}
          fallbackColor="rgba(251,77,36,0.12)"
          style={styles.doseCard}
          accessibilityRole="summary"
        >
          <View style={styles.doseHeader}>
            <Sym
              name="exclamationmark.triangle.fill"
              size={18}
              color={colors.dangerText}
            />
            <Text style={styles.doseHeaderText}>Dosing cautions</Text>
          </View>
          <View style={styles.bulletList}>
            {doseWarnings.map((w, i) => (
              <View key={i} style={styles.bulletRow}>
                <Sym
                  name="drop.fill"
                  size={13}
                  color={colors.dangerText}
                  style={styles.bulletSym}
                />
                <Text style={styles.doseBulletText}>{w}</Text>
              </View>
            ))}
          </View>
        </Glass>
      ) : null}

      {/* other likely conditions — compact glass cards */}
      {rest.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Also possible</SectionLabel>
          <GlassGroup spacing={spacing.sm} style={{ gap: spacing.sm }}>
            {rest.map((c, i) => (
              <ConditionCard key={`${c.name}-${i}`} condition={c} />
            ))}
          </GlassGroup>
        </View>
      ) : null}

      {/* trust signals */}
      <Card style={{ gap: spacing.md }}>
        <SourceList sources={result.sources ?? []} />
        <DisclaimerBanner text={result.disclaimer} />
      </Card>
    </View>
  );
}

/** Lead card: big condition name, confidence ring, urgency, evidence + steps. */
function TopConditionCard({
  condition,
  urgency,
}: {
  condition: DiagnosisCondition;
  urgency: string;
}) {
  const sev = SEVERITY[condition.severity] ?? SEVERITY.moderate!;
  const evidence = condition.evidence ?? [];
  const steps = condition.recommendedSteps ?? [];

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={styles.topHeader}>
        <ConfidenceRing confidence={condition.confidence} tone={sev.tone} />
        <View style={styles.topMeta}>
          <Text style={styles.topName}>{condition.name}</Text>
          <View style={styles.topBadges}>
            <Badge tone={sev.tone}>
              <View style={styles.iconBadgeRow}>
                <Sym
                  name={sev.symbol}
                  size={13}
                  color={TONE_TEXT_COLOR[sev.tone]}
                />
                <Text
                  style={[
                    styles.badgeInlineText,
                    { color: TONE_TEXT_COLOR[sev.tone] },
                  ]}
                >
                  {sev.label}
                </Text>
              </View>
            </Badge>
            <UrgencyBadge urgency={urgency} />
          </View>
        </View>
      </View>

      {steps.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Do this</SectionLabel>
          <View style={styles.bulletList}>
            {steps.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {evidence.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Why</SectionLabel>
          <View style={styles.bulletList}>
            {evidence.map((e, i) => (
              <View key={i} style={styles.bulletRow}>
                <Sym
                  name="checkmark.circle.fill"
                  size={14}
                  color={colors.brandSoft}
                  style={styles.bulletSym}
                />
                <Text style={styles.bulletText}>{e}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** Compact secondary condition card (no glass-in-glass; sits in a GlassGroup). */
function ConditionCard({ condition }: { condition: DiagnosisCondition }) {
  const sev = SEVERITY[condition.severity] ?? SEVERITY.moderate!;
  return (
    <Glass
      variant="regular"
      fallbackColor={colors.cardElevated}
      style={styles.conditionCard}
    >
      <View style={styles.conditionTop}>
        <Sym name={sev.symbol} size={18} color={TONE_COLOR[sev.tone]} />
        <Text style={styles.conditionName} numberOfLines={1}>
          {condition.name}
        </Text>
      </View>
      <ConfidenceBadge confidence={condition.confidence} />
    </Glass>
  );
}

/* ─────────────────────────── confidence ring ─────────────────────────── */

/** Big circular confidence indicator (visual, no prose). */
function ConfidenceRing({
  confidence,
  tone,
}: {
  confidence: number;
  tone: Tone;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const color = TONE_COLOR[tone];
  // Two half-disc rotations approximate a progress ring without SVG.
  const rightDeg = pct <= 50 ? (pct / 50) * 180 - 180 : 0;
  const leftDeg = pct > 50 ? ((pct - 50) / 50) * 180 - 180 : -180;

  return (
    <View
      style={styles.ringOuter}
      accessibilityLabel={`Confidence ${pct} percent`}
    >
      {/* progress track */}
      <View style={styles.ringTrack} />
      {/* right half */}
      <View style={styles.ringHalfClip}>
        <View
          style={[
            styles.ringHalf,
            { borderColor: color, transform: [{ rotate: `${rightDeg}deg` }] },
          ]}
        />
      </View>
      {/* left half */}
      <View style={[styles.ringHalfClip, styles.ringHalfClipLeft]}>
        <View
          style={[
            styles.ringHalf,
            styles.ringHalfLeft,
            { borderColor: color, transform: [{ rotate: `${leftDeg}deg` }] },
          ]}
        />
      </View>
      <View style={styles.ringInner}>
        <Text style={[styles.ringPct, { color }]}>{pct}</Text>
        <Text style={styles.ringUnit}>%</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────── recent ─────────────────────────── */

function RecentCard({
  diagnoses,
  loading,
}: {
  diagnoses: DiagnosisRow[];
  loading: boolean;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>Recent scans</SectionLabel>
      {loading ? (
        <Card>
          <View style={styles.loadingRow}>
            <Spinner />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        </Card>
      ) : diagnoses.length === 0 ? (
        <Card>
          <EmptyState
            Icon={StethoscopeIcon}
            title="No scans yet"
            description="Run a photo diagnosis to start a health history."
          />
        </Card>
      ) : (
        <GlassGroup spacing={spacing.sm} style={{ gap: spacing.sm }}>
          {diagnoses.map((d) => {
            const routine = d.urgency === "routine";
            return (
              <Glass
                key={d.id}
                variant="regular"
                fallbackColor={colors.cardElevated}
                style={styles.recentRow}
              >
                <Sym
                  name={
                    routine
                      ? "checkmark.seal.fill"
                      : "exclamationmark.triangle.fill"
                  }
                  size={22}
                  color={routine ? colors.brandSoft : colors.cautionText}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentSummary} numberOfLines={2}>
                    {d.summary}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {d.kind} · {fmtDate(d.created_at)}
                  </Text>
                </View>
                <UrgencyBadge urgency={d.urgency} />
              </Glass>
            );
          })}
        </GlassGroup>
      )}
    </View>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */

const RING = 96;
const RING_BORDER = 8;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  tankChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: -spacing.sm,
  },
  tankChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    maxWidth: 220,
  },

  /* kind tiles */
  kindGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  kindPressable: {
    flex: 1,
  },
  kindTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  kindTileSelected: {
    borderWidth: 1.5,
    borderColor: "rgba(79,212,192,0.55)",
  },
  kindLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  kindLabelSelected: {
    color: colors.text,
  },

  /* photo preview */
  previewWrap: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  preview: {
    width: "100%",
    height: 240,
  },
  removeBtn: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropzone: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    paddingVertical: spacing["3xl"],
    overflow: "hidden",
  },
  dropTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dropHint: {
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    color: colors.textFaint,
  },

  /* capture row */
  captureRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  captureCta: {
    flex: 1,
  },
  chooseBtn: {
    paddingHorizontal: spacing.lg,
  },
  chooseInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chooseText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },

  /* note */
  noteInput: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlignVertical: "top",
  },

  /* inline alerts */
  alertError: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,106,66,0.30)",
    backgroundColor: "rgba(251,77,36,0.10)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  alertErrorText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.dangerText,
  },
  alertNotice: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(251,191,36,0.30)",
    backgroundColor: "rgba(245,158,11,0.10)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  alertNoticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.cautionText,
  },

  /* loading */
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  skeletonWrap: {
    gap: spacing.md,
  },
  skeletonLine: {
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonBlock: {
    height: 96,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  /* top condition */
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  topMeta: {
    flex: 1,
    gap: spacing.sm,
  },
  topName: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  topBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  iconBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeInlineText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  section: {
    gap: spacing.sm,
  },

  /* confidence ring */
  ringOuter: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RING / 2,
    borderWidth: RING_BORDER,
    borderColor: "rgba(255,255,255,0.10)",
  },
  ringHalfClip: {
    position: "absolute",
    width: RING / 2,
    height: RING,
    left: RING / 2,
    overflow: "hidden",
  },
  ringHalfClipLeft: {
    left: 0,
  },
  ringHalf: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: RING_BORDER,
    borderColor: "transparent",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    left: -RING / 2,
  },
  ringHalfLeft: {
    left: 0,
  },
  ringInner: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  ringPct: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  ringUnit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textFaint,
  },

  /* dose card */
  doseCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: "hidden",
  },
  doseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  doseHeaderText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.dangerText,
  },
  doseBulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.dangerText,
  },

  /* bullets */
  bulletList: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  bulletSym: {
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,212,192,0.18)",
  },
  stepNum: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.brandSoft,
    fontVariant: ["tabular-nums"],
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: colors.text,
  },

  /* secondary condition cards */
  conditionCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: "hidden",
  },
  conditionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  conditionName: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },

  /* recent */
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  recentSummary: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  recentMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.textFaint,
  },
});
