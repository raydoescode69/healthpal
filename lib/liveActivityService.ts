import { Platform } from "react-native";
import { calculateTargets, getMealSubtitle } from "./nutritionUtils";
import type { UserProfile } from "./types";
import type { LiveActivityState, LiveActivityConfig } from "expo-live-activity";

// Conditionally load expo-live-activity (iOS only, may not be available)
let LiveActivity: typeof import("expo-live-activity") | null = null;
try {
  if (Platform.OS === "ios") {
    LiveActivity = require("expo-live-activity");
  }
} catch {
  LiveActivity = null;
}

interface DailySummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  steps?: number;
  waterGlasses?: number;
}

let activityId: string | null = null;
let activityStartTime: number = 0;
const ACTIVITY_MAX_DURATION_MS = 7.5 * 60 * 60 * 1000; // 7.5 hours (restart before 8h iOS limit)

function buildState(consumed: DailySummary, profile: Partial<UserProfile> | null | undefined): LiveActivityState {
  const targets = calculateTargets(profile);
  const remaining = Math.max(targets.calories - consumed.calories, 0);
  const progress = Math.min(consumed.calories / targets.calories, 1);

  const subtitle = [
    `\uD83D\uDD25 ${consumed.calories}/${targets.calories} cal`,
    `\uD83D\uDCAA ${consumed.protein_g}/${targets.protein}g`,
    `\uD83D\uDC63 ${consumed.steps ?? 0}/10k`,
    `\uD83D\uDCA7 ${consumed.waterGlasses ?? 0}/8`,
  ].join("  ");

  return {
    title: `${Math.round(progress * 100)}% daily goal`,
    subtitle,
    progressBar: { progress },
  };
}

const CONFIG: LiveActivityConfig = {
  backgroundColor: "#0D0D0D",
  progressViewTint: "#A8FF3E",
  titleColor: "#FFFFFF",
  subtitleColor: "#AAAAAA",
};

function isActivityExpired(): boolean {
  if (!activityStartTime) return false;
  return Date.now() - activityStartTime > ACTIVITY_MAX_DURATION_MS;
}

export async function startCalorieActivity(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  if (!LiveActivity) return;
  try {
    // End any existing activity first
    if (activityId) {
      await endCalorieActivity(consumed, profile);
    }
    const state = buildState(consumed, profile);
    const id = LiveActivity.startActivity(state, CONFIG);
    activityId = id ?? null;
    activityStartTime = Date.now();
  } catch {
    activityId = null;
  }
}

export async function updateCalorieActivity(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  if (!LiveActivity) return;

  // Restart if expired or no active activity
  if (!activityId || isActivityExpired()) {
    await startCalorieActivity(consumed, profile);
    return;
  }

  try {
    const state = buildState(consumed, profile);
    LiveActivity.updateActivity(activityId, state);
  } catch {
    // Activity may have been dismissed — restart
    activityId = null;
    await startCalorieActivity(consumed, profile);
  }
}

export async function endCalorieActivity(
  consumed: DailySummary,
  profile: Partial<UserProfile> | null | undefined
): Promise<void> {
  if (!LiveActivity || !activityId) return;
  try {
    const state = buildState(consumed, profile);
    LiveActivity.stopActivity(activityId, state);
  } catch {
    // Ignore — activity may already be gone
  } finally {
    activityId = null;
    activityStartTime = 0;
  }
}

export function hasActiveActivity(): boolean {
  return activityId !== null;
}
