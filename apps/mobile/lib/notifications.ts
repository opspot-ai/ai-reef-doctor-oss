import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { Reminder } from "@reef/shared";
import { REMINDER_KIND_LABEL } from "@/lib/format";

/**
 * Push / local-notification helpers (expo-notifications).
 *
 * Design rule: NOTHING here ever throws. Permissions can be denied, the app can
 * run in a simulator (no real push token), the EAS projectId can be absent, and
 * services can be unavailable — every path resolves to a safe value (a status,
 * a token, or null) instead of crashing the screen that called it.
 *
 * We do NOT auto-prompt on launch. A screen explicitly drives permission via
 * `requestNotificationPermissions()` (wired to an "Enable reminders" button),
 * per platform best practice and App Review expectations.
 */

/* ─────────────────────── handler (foreground display) ─────────────────────── */

/**
 * Configure how notifications are shown while the app is foregrounded. Called
 * once at module load; wrapped so a missing native module never breaks import.
 */
function configureHandler() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // SDK 53+ replaced `shouldShowAlert` with the more granular
        // `shouldShowBanner` / `shouldShowList`.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Native module unavailable (e.g. unexpected runtime) — skip silently.
  }
}
configureHandler();

/* ─────────────────────────── permissions ─────────────────────────── */

export type PermissionState = "granted" | "denied" | "undetermined";

/** Read the current permission state without prompting. */
export async function getNotificationPermissions(): Promise<PermissionState> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return normalizePermission(settings);
  } catch {
    return "undetermined";
  }
}

/**
 * Request notification permission (safe to call from a button handler). Returns
 * the resulting state; on iOS we request alert + sound + badge. Never throws.
 */
export async function requestNotificationPermissions(): Promise<PermissionState> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return "granted";

    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return normalizePermission(settings);
  } catch {
    return "denied";
  }
}

function normalizePermission(
  settings: Notifications.NotificationPermissionsStatus,
): PermissionState {
  if (settings.granted) return "granted";
  // iOS provisional authorization still counts as usable.
  const iosStatus = settings.ios?.status;
  if (
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return "granted";
  }
  if (settings.status === "undetermined" || settings.canAskAgain) {
    return "undetermined";
  }
  return "denied";
}

/* ─────────────────────────── push token ─────────────────────────── */

/**
 * Register for push and return the Expo push token, or null.
 *
 * Returns null (never throws) when:
 *  - permission isn't granted,
 *  - running on a simulator / device that can't get a token,
 *  - the EAS projectId is missing (common in bare/dev before EAS is set up),
 *  - Expo's token service is unreachable.
 *
 * A caller can persist the returned token to the backend for server-sent push;
 * a null result simply means push isn't available right now — local reminder
 * notifications (`scheduleReminderNotification`) still work.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const state = await requestNotificationPermissions();
    if (state !== "granted") return null;

    // Android needs a channel before tokens/notifications behave well.
    if (Platform.OS === "android") {
      await ensureAndroidChannel();
    }

    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResponse?.data ?? null;
  } catch {
    // Simulator, missing credentials, or network failure — push unavailable.
    return null;
  }
}

/** Pull the EAS projectId from app config when present (else undefined). */
function resolveProjectId(): string | undefined {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  // `easConfig` is populated under EAS Build.
  const fromEasConfig = (
    Constants as unknown as {
      easConfig?: { projectId?: string };
    }
  ).easConfig?.projectId;
  const id = fromExpoConfig ?? fromEasConfig;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

async function ensureAndroidChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Tank reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Channel setup is best-effort.
  }
}

/* ─────────────────────────── scheduling ─────────────────────────── */

/**
 * Schedule a local notification for a reminder's `due_at`. Returns the OS
 * notification id (to cancel later) or null when it can't be scheduled
 * (permission denied, due date in the past, or any failure). Never throws.
 *
 * If the due date is already in the past we skip rather than firing instantly.
 */
export async function scheduleReminderNotification(
  reminder: Reminder,
): Promise<string | null> {
  try {
    const state = await getNotificationPermissions();
    if (state !== "granted") return null;

    const dueDate = new Date(reminder.due_at);
    if (Number.isNaN(dueDate.getTime())) return null;
    if (dueDate.getTime() <= Date.now()) return null; // don't fire in the past

    const kindLabel = REMINDER_KIND_LABEL[reminder.kind] ?? "Reminder";

    const id = await Notifications.scheduleNotificationAsync({
      identifier: `reminder_${reminder.id}`,
      content: {
        title: reminder.title || kindLabel,
        body: `${kindLabel} is due for your tank.`,
        data: { reminderId: reminder.id, tankId: reminder.tank_id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dueDate,
      },
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Schedule notifications for a batch of reminders. Returns how many were
 * successfully scheduled. Skips inactive / past-due reminders implicitly.
 */
export async function scheduleAllReminders(
  reminders: Reminder[],
): Promise<number> {
  let scheduled = 0;
  for (const r of reminders) {
    if (r.active === false) continue;
    const id = await scheduleReminderNotification(r);
    if (id) scheduled += 1;
  }
  return scheduled;
}

/** Cancel a previously-scheduled reminder notification. Never throws. */
export async function cancelReminderNotification(
  reminderId: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`reminder_${reminderId}`);
  } catch {
    // Already gone / unavailable — nothing to do.
  }
}

/** Cancel every scheduled local notification (e.g. on sign-out). Never throws. */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
