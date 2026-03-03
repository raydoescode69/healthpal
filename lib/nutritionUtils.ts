import type { UserProfile } from "./types";

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function calculateTargets(profile: Partial<UserProfile> | null | undefined): NutritionTargets {
  if (!profile?.weight_kg || !profile?.height_cm || !profile?.age) {
    return { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  }
  const bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5;
  const tdee = bmr * 1.55;
  const goal = (profile.goal || "").toLowerCase();
  let cal = Math.round(tdee);
  if (goal.includes("lose")) cal = Math.round(tdee - 500);
  if (goal.includes("gain") || goal.includes("muscle")) cal = Math.round(tdee + 400);

  let pPct = 0.3, cPct = 0.4, fPct = 0.3;
  if (goal.includes("lose")) { pPct = 0.35; cPct = 0.35; fPct = 0.3; }
  if (goal.includes("gain") || goal.includes("muscle")) { pPct = 0.35; cPct = 0.45; fPct = 0.2; }
  if (goal.includes("keto")) { pPct = 0.3; cPct = 0.1; fPct = 0.6; }

  return {
    calories: cal,
    protein: Math.round((cal * pPct) / 4),
    carbs: Math.round((cal * cPct) / 4),
    fat: Math.round((cal * fPct) / 9),
  };
}

// ── Meal Reminders ──────────────────────────────────────────

interface MealReminder {
  meal: string;
  message: string;
  hour: number;
}

const MEAL_SCHEDULE: MealReminder[] = [
  { meal: "Breakfast", message: "Time for breakfast!", hour: 8 },
  { meal: "Lunch", message: "Time for lunch!", hour: 12 },
  { meal: "Snack", message: "Snack time!", hour: 15 },
  { meal: "Dinner", message: "Time for dinner!", hour: 19 },
];

export function getCurrentMealReminder(): MealReminder | null {
  const hour = new Date().getHours();
  return MEAL_SCHEDULE.find((m) => hour === m.hour) ?? null;
}

export function getNextMealReminder(): MealReminder | null {
  const hour = new Date().getHours();
  return MEAL_SCHEDULE.find((m) => m.hour > hour) ?? null;
}

export function getMealSubtitle(caloriesRemaining: number): string {
  const current = getCurrentMealReminder();
  if (current) return current.message;

  const next = getNextMealReminder();
  if (next) return `${caloriesRemaining} cal left \u2014 ${next.meal} coming up`;

  return `${caloriesRemaining} cal left`;
}
