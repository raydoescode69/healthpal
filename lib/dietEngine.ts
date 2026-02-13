// ── Diet Engine ──────────────────────────────────────────────────
// Algorithm for generating personalized 7-day meal plans using the
// knowledge base. Works entirely offline — no API calls needed.

import type { DietPlanData, DietDay, DietMeal } from "./types";
import {
  type KBMeal,
  type MealSlot,
  getMealsBySlot,
  filterByDiet,
  filterByAllergies,
  SLOT_TIMES,
} from "./dietKnowledgeBase";

// ── Profile input for the engine ─────────────────────────────────
interface DietProfile {
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  goal?: string | null;
  diet_type?: string | null;
  allergies?: string | null;
}

// ── Calorie & macro calculations (Mifflin-St Jeor) ──────────────
function calculateDailyCalories(p: DietProfile | null): number {
  if (!p?.weight_kg || !p?.height_cm || !p?.age) return 2000;
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5;
  const tdee = bmr * 1.55; // moderate activity
  const goal = (p.goal || "").toLowerCase();
  if (goal.includes("lose")) return Math.round(tdee - 500);
  if (goal.includes("gain") || goal.includes("muscle")) return Math.round(tdee + 400);
  return Math.round(tdee);
}

interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function calculateMacroTargets(calories: number, goal: string | null | undefined): MacroTargets {
  const g = (goal || "").toLowerCase();
  let pPct = 0.3, cPct = 0.4, fPct = 0.3;
  if (g.includes("lose")) { pPct = 0.35; cPct = 0.35; fPct = 0.3; }
  if (g.includes("gain") || g.includes("muscle")) { pPct = 0.35; cPct = 0.45; fPct = 0.2; }
  if (g.includes("keto")) { pPct = 0.3; cPct = 0.1; fPct = 0.6; }
  return {
    protein_g: Math.round((calories * pPct) / 4),
    carbs_g: Math.round((calories * cPct) / 4),
    fat_g: Math.round((calories * fPct) / 9),
  };
}

// ── Utility: seeded shuffle for variety ──────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Slot ordering for a day ──────────────────────────────────────
const DAY_SLOTS: MealSlot[] = [
  "breakfast",
  "mid_morning_snack",
  "lunch",
  "evening_snack",
  "dinner",
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Calorie distribution across slots ────────────────────────────
// Defines what % of daily calories each slot should roughly target.
const SLOT_CALORIE_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  mid_morning_snack: 0.10,
  lunch: 0.30,
  evening_snack: 0.10,
  dinner: 0.25,
};

// ── Pick best meal for a slot ────────────────────────────────────
// Selects from available pool, scoring by how close the meal's
// calories are to the slot target. Adds randomness via shuffle.
function pickMeal(
  pool: KBMeal[],
  targetCal: number,
  usedNames: Set<string>
): KBMeal | null {
  // Filter out already-used meals for variety
  let candidates = pool.filter((m) => !usedNames.has(m.name));

  // If we run out of unique options, allow repeats
  if (candidates.length === 0) candidates = pool;
  if (candidates.length === 0) return null;

  // Shuffle first for randomness, then sort by distance to target cal
  const shuffled = shuffle(candidates);
  shuffled.sort((a, b) => {
    const distA = Math.abs(a.cal - targetCal);
    const distB = Math.abs(b.cal - targetCal);
    return distA - distB;
  });

  // Pick from top 3 candidates randomly for more variety
  const topN = shuffled.slice(0, Math.min(3, shuffled.length));
  return topN[Math.floor(Math.random() * topN.length)];
}

// ── Convert KBMeal to DietMeal for output ────────────────────────
function toDietMeal(meal: KBMeal, slot: MealSlot): DietMeal {
  return {
    emoji: meal.emoji,
    name: meal.name,
    time: SLOT_TIMES[slot],
    cal: meal.cal,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    portion: meal.portion,
  };
}

// ── Build available pool for each slot ───────────────────────────
function buildSlotPool(
  slot: MealSlot,
  dietType: string | null | undefined,
  allergies: string | null | undefined,
  goal: string | null | undefined
): KBMeal[] {
  let pool = getMealsBySlot(slot);
  pool = filterByDiet(pool, dietType);
  pool = filterByAllergies(pool, allergies);

  // Boost high-protein for muscle gain, low-carb for keto/lose
  const g = (goal || "").toLowerCase();
  if (g.includes("gain") || g.includes("muscle")) {
    const highProtein = pool.filter((m) => m.tags.includes("high_protein"));
    if (highProtein.length >= 3) {
      // Weight high-protein options more heavily by duplicating in pool
      pool = [...pool, ...highProtein];
    }
  }
  if (g.includes("keto")) {
    const ketoFriendly = pool.filter((m) => m.tags.includes("keto") || m.tags.includes("low_carb"));
    if (ketoFriendly.length >= 3) {
      pool = [...pool, ...ketoFriendly];
    }
  }
  if (g.includes("lose")) {
    const lowCarb = pool.filter((m) => m.tags.includes("low_carb") || m.tags.includes("high_protein"));
    if (lowCarb.length >= 3) {
      pool = [...pool, ...lowCarb];
    }
  }

  return pool;
}

// ── Main: Generate a 7-day diet plan ─────────────────────────────
export function generateDietPlan(profile: DietProfile | null): DietPlanData {
  const p = profile || {};
  const dailyCal = calculateDailyCalories(p);
  const macros = calculateMacroTargets(dailyCal, p.goal);
  const isPersonalized = !!(p.weight_kg && p.height_cm && p.age);

  // Pre-build pools for each slot
  const slotPools: Record<MealSlot, KBMeal[]> = {} as any;
  for (const slot of DAY_SLOTS) {
    slotPools[slot] = buildSlotPool(slot, p.diet_type, p.allergies, p.goal);
  }

  // Track globally used meals across all 7 days for max variety
  const globalUsed = new Set<string>();

  const days: DietDay[] = DAY_NAMES.map((dayName) => {
    const meals: DietMeal[] = [];
    const dayUsed = new Set<string>(globalUsed);

    for (const slot of DAY_SLOTS) {
      const targetCal = Math.round(dailyCal * SLOT_CALORIE_SHARE[slot]);
      const pool = slotPools[slot];
      const picked = pickMeal(pool, targetCal, dayUsed);

      if (picked) {
        meals.push(toDietMeal(picked, slot));
        dayUsed.add(picked.name);
        globalUsed.add(picked.name);
      }
    }

    return { day: dayName, meals };
  });

  return {
    type: "DIET_PLAN",
    is_personalized: isPersonalized,
    daily_calories: dailyCal,
    daily_protein_g: macros.protein_g,
    daily_carbs_g: macros.carbs_g,
    daily_fat_g: macros.fat_g,
    days,
  };
}

// ── Generate diet plan as minified JSON string ───────────────────
// Ready to be embedded in chat responses with the DIET_PLAN: prefix.
export function generateDietPlanJSON(profile: DietProfile | null): string {
  const plan = generateDietPlan(profile);
  return JSON.stringify(plan);
}

// ── Calorie/macro info for display purposes ──────────────────────
export function getUserTargets(profile: DietProfile | null): {
  dailyCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const cal = calculateDailyCalories(profile);
  const macros = calculateMacroTargets(cal, profile?.goal);
  return { dailyCalories: cal, ...macros };
}
