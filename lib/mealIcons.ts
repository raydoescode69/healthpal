// Centralized meal-type → Ionicons mapping
// Replaces the duplicated MEAL_EMOJI / MEAL_EMOJIS maps across the codebase.

const MEAL_ICON_MAP: Record<string, string> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

export function getMealIcon(mealType: string | undefined | null): string {
  return MEAL_ICON_MAP[(mealType || "").toLowerCase()] ?? "restaurant-outline";
}
