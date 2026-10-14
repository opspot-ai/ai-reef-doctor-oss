import * as React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";
import { Screen, Card, Title, Subtitle, GlassCTA, Sym } from "@/components/ui";
import { Glass, GlassGroup } from "@/components/glass";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";

/**
 * Shared sign-in / sign-up — Liquid Glass, visual-first.
 *
 * A big brand SF Symbol, a glass auth card with minimal labeled inputs, a single
 * focal GlassCTA (Sign in / Create account), and Apple/Google as glass buttons
 * carrying their own SF Symbols. The demo notice is a short glass chip.
 *
 * mobile purchase policy compliance: account-based unlock only — NO in-app subscribe and NO
 * external-purchase CTA anywhere. All original behavior is preserved.
 */

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const isSignUp = mode === "sign-up";

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const result = isSignUp
        ? await auth.signUpWithPassword(email, password, fullName)
        : await auth.signInWithPassword(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        router.replace("/(tabs)");
      }
    } finally {
      setPending(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setError(null);
    Haptics.selectionAsync().catch(() => {});
    const result = await auth.signInWithOAuth(provider);
    if (result.error) setError(result.error);
  }

  function enterDemo() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace("/(tabs)");
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ gap: spacing.xl }}
      >
        {/* Brand mark */}
        <View style={styles.brand}>
          <Glass
            variant="regular"
            tintColor={colors.brand}
            fallbackColor={colors.brand}
            style={styles.logo}
          >
            <Sym name="fish.fill" size={30} color={colors.textOnAccent} />
          </Glass>
          <View style={{ gap: spacing.xs }}>
            <Title>{isSignUp ? "Create account" : "Welcome back"}</Title>
            <Subtitle>
              {isSignUp ? "Track your reef with AI" : "Sign in to your reef"}
            </Subtitle>
          </View>
        </View>

        {/* Demo notice — short glass chip */}
        {auth.isDemo ? (
          <Glass
            variant="regular"
            fallbackColor={colors.cardElevated}
            style={styles.notice}
          >
            <Sym name="sparkles" size={16} color={colors.brandSoft} />
            <Text style={styles.noticeText}>
              Demo mode — no backend. Explore without an account.
            </Text>
          </Glass>
        ) : null}

        {/* Error — short glass chip */}
        {error ? (
          <Glass
            variant="regular"
            tintColor={colors.danger}
            fallbackColor="rgba(251,77,36,0.14)"
            style={styles.errorBox}
          >
            <Sym name="exclamationmark.triangle.fill" size={16} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </Glass>
        ) : null}

        {/* Auth card — solid inputs inside glass (no glass-in-glass) */}
        <Card>
          <View style={{ gap: spacing.md }}>
            {isSignUp ? (
              <Field
                label="Name"
                symbol="person.fill"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                autoCapitalize="words"
              />
            ) : null}
            <Field
              label="Email"
              symbol="envelope.fill"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Password"
              symbol="lock.fill"
              value={password}
              onChangeText={setPassword}
              placeholder={isSignUp ? "Create a password" : "Your password"}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </Card>

        {/* Focal action */}
        <GlassCTA
          label={
            pending
              ? isSignUp
                ? "Creating…"
                : "Signing in…"
              : isSignUp
                ? "Create account"
                : "Sign in"
          }
          symbol={isSignUp ? "person.badge.plus" : "arrow.right.circle.fill"}
          tone="brand"
          disabled={pending}
          onPress={submit}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* OAuth — glass siblings grouped */}
        <GlassGroup spacing={spacing.md} style={{ gap: spacing.md }}>
          <OAuthButton
            symbol="apple.logo"
            label="Continue with Apple"
            onPress={() => oauth("apple")}
          />
          <OAuthButton
            symbol="globe"
            label="Continue with Google"
            onPress={() => oauth("google")}
          />
        </GlassGroup>

        {/* Demo skip */}
        {auth.isDemo ? (
          <Pressable
            onPress={enterDemo}
            style={styles.demoLink}
            accessibilityRole="button"
            accessibilityLabel="Skip and explore the demo"
          >
            <Text style={styles.demoLinkText}>Skip & explore the demo</Text>
            <Sym name="arrow.right" size={14} color={colors.brandSoft} />
          </Pressable>
        ) : null}

        {/* Footer link */}
        <View style={styles.footer}>
          {isSignUp ? (
            <Text style={styles.footerText}>
              Have an account?{" "}
              <Link href="/(auth)/sign-in" style={styles.footerLink}>
                Sign in
              </Link>
            </Text>
          ) : (
            <Text style={styles.footerText}>
              New here?{" "}
              <Link href="/(auth)/sign-up" style={styles.footerLink}>
                Create an account
              </Link>
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ─────────────────────────── OAuth glass button ─────────────────────────── */

function OAuthButton({
  symbol,
  label,
  onPress,
}: {
  symbol: React.ComponentProps<typeof Sym>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Glass
        variant="regular"
        interactive
        fallbackColor={colors.cardElevated}
        style={styles.oauthBtn}
      >
        <Sym name={symbol} size={18} color={colors.text} />
        <Text style={styles.oauthText}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/* ─────────────────────────── labeled input ─────────────────────────── */

function Field({
  label,
  symbol,
  ...props
}: {
  label: string;
  symbol: React.ComponentProps<typeof Sym>["name"];
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.fieldLabelRow}>
        <Sym name={symbol} size={13} color={colors.brandSoft} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii["2xl"],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: "rgba(212,233,244,0.9)",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.dangerText,
    fontWeight: fontWeight.medium,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    minHeight: 48,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.full,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  oauthText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  demoLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  demoLinkText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.brandSoft,
  },
  footer: {
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  footerLink: {
    color: colors.brandSoft,
    fontWeight: fontWeight.semibold,
  },
});
