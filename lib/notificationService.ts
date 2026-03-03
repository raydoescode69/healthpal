import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { supabase } from "./supabase";

// ── Android Notification Channels ───────────────────────────────
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("calorie-progress", {
    name: "Daily Progress",
    importance: Notifications.AndroidImportance.LOW,
    sound: undefined,
    vibrationPattern: [],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: false,
    showBadge: false,
  });

  await Notifications.setNotificationChannelAsync("followups", {
    name: "Follow-ups",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync("general", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

// ── Foreground Notification Handler ─────────────────────────────
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const channelId =
        notification.request.content.data?.channelId ??
        (notification.request.trigger as any)?.channelId;

      // Show calorie-progress as silent sticky (no popup/sound, but visible in shade)
      if (channelId === "calorie-progress") {
        return {
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySoundInForeground: false,
        };
      }

      // Show followups as alerts in foreground
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySoundInForeground: false,
      };
    },
  });
}

// ── Notification Tap Handler ────────────────────────────────────
export function setupNotificationResponseHandler(): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data?.type === "meal-reminder") {
      router.push("/(main)/dashboard?openFoodLog=true");
    } else if (data?.conversationId) {
      router.push(`/(main)/chat?conversationId=${data.conversationId}`);
    } else if (data?.channelId === "calorie-progress") {
      router.push("/(main)/dashboard");
    }
  });
}

// ── Permission Request + Push Token Registration ────────────────
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo" || !Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Notifications] Push requires a physical device");
    return null;
  }

  if (isExpoGo()) {
    console.log("[Notifications] Push notifications not supported in Expo Go (SDK 53+). Use a dev build.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission not granted");
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[Notifications] No EAS projectId found in app.json extra");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log("[Notifications] Push token:", token);

    // Upsert token to push_tokens table
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    if (error) {
      console.warn("[Notifications] Token upsert failed:", error.message);
    }

    return token;
  } catch (e) {
    console.warn("[Notifications] Token registration error:", e);
    return null;
  }
}

// ── Meal Reminders ──────────────────────────────────────────────

const MEAL_REMINDERS = [
  { id: "meal-reminder-breakfast", meal: "Breakfast", hour: 8, body: "Time for breakfast! Log what you eat 🍳" },
  { id: "meal-reminder-lunch", meal: "Lunch", hour: 12, body: "Lunch time! Don't forget to log your meal 🥗" },
  { id: "meal-reminder-snack", meal: "Snack", hour: 15, body: "Snack time! Log it to stay on track 🍎" },
  { id: "meal-reminder-dinner", meal: "Dinner", hour: 19, body: "Dinner time! Log your meal to complete the day 🍽️" },
] as const;

export async function cancelMealReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith("meal-reminder-")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export async function scheduleMealReminders(): Promise<void> {
  if (isExpoGo()) {
    console.log("[Notifications] Meal reminders skipped in Expo Go");
    return;
  }

  await cancelMealReminders();

  for (const reminder of MEAL_REMINDERS) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: "Nyra",
        body: reminder.body,
        data: { type: "meal-reminder", channelId: "followups" },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: 0,
        channelId: "followups",
      },
    });
  }

  console.log("[Notifications] Meal reminders scheduled");
}

// ── Logout Cleanup ──────────────────────────────────────────────
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.warn("[Notifications] Token cleanup failed:", error.message);
    }
  } catch (e) {
    console.warn("[Notifications] Token cleanup error:", e);
  }
}
