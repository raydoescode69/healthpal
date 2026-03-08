import type { AuraLabel } from "./types";

// ── Input / Output types ─────────────────────────────────────
export interface AuraInput {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  waterGlasses: number;
  steps: number;
  sleepHours?: number;
}

export interface AuraResult {
  score: number;
  sleepScore: number;
  nutritionScore: number;
  movementScore: number;
  hydrationScore: number;
  label: AuraLabel;
  description: string;
}

// ── Weights ──────────────────────────────────────────────────
const SLEEP_WEIGHT = 0.25;
const NUTRITION_WEIGHT = 0.3;
const MOVEMENT_WEIGHT = 0.25;
const HYDRATION_WEIGHT = 0.2;

// ── Sub-score calculators ────────────────────────────────────

/** Sleep: 8h = 100, linear scale. <4h = 0, >10h caps at 85 */
function calcSleep(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 4) return Math.round((hours / 4) * 25); // 0-25 for 0-4h
  if (hours <= 8) return Math.round(25 + ((hours - 4) / 4) * 75); // 25-100 for 4-8h
  if (hours <= 10) return Math.round(100 - ((hours - 8) / 2) * 15); // 100-85 for 8-10h
  return 85; // cap at 85 for oversleep
}

/** Nutrition: based on calorie target adherence (2000 cal) + protein bonus */
function calcNutrition(calories: number, protein_g: number): number {
  if (calories <= 0) return 0;

  const target = 2000;
  const ratio = calories / target;

  // 80-120% of target = 100, farther = lower
  let score: number;
  if (ratio >= 0.8 && ratio <= 1.2) {
    score = 100;
  } else if (ratio < 0.8) {
    // Scale down: 0 cals = 0, 80% = 100
    score = Math.round((ratio / 0.8) * 100);
  } else {
    // Over 120%: each 20% over drops score by 25
    const overRatio = (ratio - 1.2) / 0.2;
    score = Math.max(0, Math.round(100 - overRatio * 25));
  }

  // Protein bonus: >30% of cals from protein = +10 (capped at 100)
  const proteinCals = protein_g * 4;
  if (calories > 0 && proteinCals / calories >= 0.3) {
    score = Math.min(100, score + 10);
  }

  return Math.max(0, Math.min(100, score));
}

/** Movement: steps / 10000 * 100, capped at 100 */
function calcMovement(steps: number): number {
  if (steps <= 0) return 0;
  return Math.min(100, Math.round((steps / 10000) * 100));
}

/** Hydration: waterGlasses / 8 * 100, capped at 100 */
function calcHydration(glasses: number): number {
  if (glasses <= 0) return 0;
  return Math.min(100, Math.round((glasses / 8) * 100));
}

// ── Label / description mapping ──────────────────────────────

const LABEL_MAP: { min: number; label: AuraLabel; description: string }[] = [
  {
    min: 75,
    label: "THRIVING",
    description: "You slept well, ate clean, and moved. Keep this up.",
  },
  {
    min: 50,
    label: "RESTING",
    description: "Decent day. A few tweaks and you'll be glowing.",
  },
  {
    min: 25,
    label: "PUSHING",
    description: "Room to improve. Focus on hydration and movement.",
  },
  {
    min: 0,
    label: "STRUGGLING",
    description: "Rough day. Tomorrow's a fresh start.",
  },
];

// ── Color mapping ────────────────────────────────────────────

const COLOR_MAP: { min: number; color: string }[] = [
  { min: 75, color: "#bef135" }, // lime
  { min: 50, color: "#38bdf8" }, // blue
  { min: 25, color: "#fb923c" }, // orange
  { min: 0, color: "#ef4444" },  // red
];

// ── Public API ───────────────────────────────────────────────

export function calculateAuraScore(input: AuraInput): AuraResult {
  const sleepHours = input.sleepHours ?? 7;

  const sleepScore = calcSleep(sleepHours);
  const nutritionScore = calcNutrition(input.calories, input.protein_g);
  const movementScore = calcMovement(input.steps);
  const hydrationScore = calcHydration(input.waterGlasses);

  const rawScore =
    sleepScore * SLEEP_WEIGHT +
    nutritionScore * NUTRITION_WEIGHT +
    movementScore * MOVEMENT_WEIGHT +
    hydrationScore * HYDRATION_WEIGHT;

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const { label, description } = getAuraLabel(score);

  return {
    score,
    sleepScore,
    nutritionScore,
    movementScore,
    hydrationScore,
    label,
    description,
  };
}

export function getAuraColor(score: number): string {
  for (const entry of COLOR_MAP) {
    if (score >= entry.min) return entry.color;
  }
  return COLOR_MAP[COLOR_MAP.length - 1].color;
}

export function getAuraLabel(score: number): {
  label: AuraLabel;
  description: string;
} {
  for (const entry of LABEL_MAP) {
    if (score >= entry.min) {
      return { label: entry.label, description: entry.description };
    }
  }
  return {
    label: LABEL_MAP[LABEL_MAP.length - 1].label,
    description: LABEL_MAP[LABEL_MAP.length - 1].description,
  };
}
