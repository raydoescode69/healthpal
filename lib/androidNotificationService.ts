import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { calculateTargets, getMealSubtitle } from "./nutritionUtils";
import type { UserProfile } from "./types";

const isExpoGo = Constants.appOwnership === "expo";

interface DailySummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  steps?: number;
  waterGlasses?: number;
}

const NOTIFICATION_ID = "calorie-progress-sticky";

function formatSteps(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function buildNotificationContent(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
) {
  const targets = calculateTargets(profile);
  const remaining = Math.max(targets.calories - consumed.calories, 0);

  const title = remaining > 0
    ? `${consumed.calories} / ${targets.calories} kcal \u2022 ${remaining} left`
    : `${consumed.calories} / ${targets.calories} kcal \u2022 Goal hit!`;

  const parts = [
    `P: ${consumed.protein_g}g`,
    `C: ${consumed.carbs_g}g`,
    `F: ${consumed.fat_g}g`,
    `Steps: ${formatSteps(consumed.steps ?? 0)}`,
    `Water: ${consumed.waterGlasses ?? 0}/8`,
  ];
  const body = parts.join("  \u2022  ");

  return { title, body };
}

export async function showCalorieNotification(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  if (Platform.OS !== "android" || isExpoGo) return;

  try {
    const { title, body } = buildNotificationContent(consumed, profile);

    console.log("[AndroidNotification] Showing sticky notification:", title);
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { channelId: "calorie-progress" },
      },
      trigger: {
        channelId: "calorie-progress",
      },
    });
    console.log("[AndroidNotification] Sticky notification scheduled successfully");
  } catch (e) {
    console.warn("[AndroidNotification] Show failed:", e);
  }
}

export async function updateCalorieNotification(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  // Same ID replaces existing notification
  await showCalorieNotification(consumed, profile);
}

export async function dismissCalorieNotification(): Promise<void> {
  if (Platform.OS !== "android" || isExpoGo) return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Notification may not exist
  }
}
