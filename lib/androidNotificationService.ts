import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { calculateTargets, getMealSubtitle } from "./nutritionUtils";
import type { UserProfile } from "./types";

interface DailySummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const NOTIFICATION_ID = "calorie-progress-sticky";

function buildProgressBar(progress: number, width: number = 20): string {
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function buildNotificationContent(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
) {
  const targets = calculateTargets(profile);
  const remaining = Math.max(targets.calories - consumed.calories, 0);
  const progress = Math.min(consumed.calories / targets.calories, 1);
  const pct = Math.round(progress * 100);

  const title = `${consumed.calories.toLocaleString()} / ${targets.calories.toLocaleString()} cal (${pct}%)`;
  const subtitle = getMealSubtitle(remaining);

  const macros = [
    `P: ${consumed.protein_g}/${targets.protein}g`,
    `C: ${consumed.carbs_g}/${targets.carbs}g`,
    `F: ${consumed.fat_g}/${targets.fat}g`,
  ].join("  |  ");

  const body = `${buildProgressBar(progress)}\n${macros}\n${subtitle}`;

  return { title, body };
}

export async function showCalorieNotification(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  if (Platform.OS !== "android") return;

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
        priority: Notifications.AndroidNotificationPriority.MAX,
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
  if (Platform.OS !== "android") return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Notification may not exist
  }
}
