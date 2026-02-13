// ── Diet Knowledge Base ──────────────────────────────────────────
// Comprehensive Indian + global food database for diet plan generation.
// Each meal has verified macros per standard serving.

export type MealSlot = "breakfast" | "mid_morning_snack" | "lunch" | "evening_snack" | "dinner";

export interface KBMeal {
  name: string;
  emoji: string;
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
  slot: MealSlot[];
  tags: string[]; // "veg" | "non_veg" | "vegan" | "keto" | "high_protein" | "low_carb"
}

// ── Breakfast options ───────────────────────────────────────────
export const BREAKFAST_MEALS: KBMeal[] = [
  { name: "Masala Oats", emoji: "\uD83E\uDD63", cal: 280, protein_g: 10, carbs_g: 42, fat_g: 8, portion: "1 bowl (200g)", slot: ["breakfast"], tags: ["veg", "high_protein"] },
  { name: "Poha with Peanuts", emoji: "\uD83C\uDF5A", cal: 310, protein_g: 8, carbs_g: 48, fat_g: 10, portion: "1 plate (200g)", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Idli Sambar (3 pcs)", emoji: "\uD83E\uDD5F", cal: 290, protein_g: 9, carbs_g: 50, fat_g: 5, portion: "3 idlis + sambar", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Moong Dal Chilla", emoji: "\uD83E\uDED3", cal: 250, protein_g: 14, carbs_g: 32, fat_g: 7, portion: "2 chillas", slot: ["breakfast"], tags: ["veg", "high_protein", "vegan"] },
  { name: "Egg Bhurji + Toast", emoji: "\uD83C\uDF73", cal: 340, protein_g: 18, carbs_g: 28, fat_g: 16, portion: "2 eggs + 2 toast", slot: ["breakfast"], tags: ["non_veg", "high_protein"] },
  { name: "Besan Chilla", emoji: "\uD83E\uDED3", cal: 220, protein_g: 12, carbs_g: 26, fat_g: 8, portion: "2 chillas", slot: ["breakfast"], tags: ["veg", "high_protein", "vegan"] },
  { name: "Upma", emoji: "\uD83C\uDF5A", cal: 270, protein_g: 7, carbs_g: 40, fat_g: 9, portion: "1 bowl (200g)", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Paneer Paratha", emoji: "\uD83E\uDED3", cal: 380, protein_g: 16, carbs_g: 40, fat_g: 16, portion: "2 parathas", slot: ["breakfast"], tags: ["veg", "high_protein"] },
  { name: "Oats Smoothie Bowl", emoji: "\uD83E\uDD63", cal: 320, protein_g: 12, carbs_g: 48, fat_g: 8, portion: "1 bowl (250ml)", slot: ["breakfast"], tags: ["veg"] },
  { name: "Dosa + Chutney", emoji: "\uD83E\uDED3", cal: 260, protein_g: 6, carbs_g: 42, fat_g: 8, portion: "2 dosas", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Greek Yogurt + Granola", emoji: "\uD83E\uDD63", cal: 300, protein_g: 18, carbs_g: 36, fat_g: 8, portion: "200g yogurt + 40g granola", slot: ["breakfast"], tags: ["veg", "high_protein"] },
  { name: "Aloo Paratha + Curd", emoji: "\uD83E\uDED3", cal: 370, protein_g: 10, carbs_g: 48, fat_g: 14, portion: "2 parathas + curd", slot: ["breakfast"], tags: ["veg"] },
  { name: "Boiled Eggs + Avocado Toast", emoji: "\uD83E\uDD51", cal: 350, protein_g: 20, carbs_g: 22, fat_g: 20, portion: "2 eggs + 1 toast", slot: ["breakfast"], tags: ["non_veg", "keto", "high_protein"] },
  { name: "Ragi Dosa", emoji: "\uD83E\uDED3", cal: 230, protein_g: 7, carbs_g: 38, fat_g: 6, portion: "2 dosas", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Omelette + Multigrain Bread", emoji: "\uD83C\uDF73", cal: 320, protein_g: 20, carbs_g: 24, fat_g: 14, portion: "2 egg omelette + 2 slices", slot: ["breakfast"], tags: ["non_veg", "high_protein"] },
  { name: "Peanut Butter Toast + Banana", emoji: "\uD83C\uDF5E", cal: 340, protein_g: 12, carbs_g: 44, fat_g: 14, portion: "2 toast + 1 banana", slot: ["breakfast"], tags: ["veg", "vegan"] },
  { name: "Sprouts Salad", emoji: "\uD83E\uDD57", cal: 200, protein_g: 12, carbs_g: 28, fat_g: 4, portion: "1 bowl (150g)", slot: ["breakfast"], tags: ["veg", "vegan", "high_protein", "low_carb"] },
  { name: "Pesarattu (Green Gram Dosa)", emoji: "\uD83E\uDED3", cal: 240, protein_g: 12, carbs_g: 32, fat_g: 6, portion: "2 dosas", slot: ["breakfast"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Keto Paneer Scramble", emoji: "\uD83E\uDDC0", cal: 300, protein_g: 22, carbs_g: 6, fat_g: 22, portion: "150g paneer", slot: ["breakfast"], tags: ["veg", "keto", "high_protein", "low_carb"] },
  { name: "Egg White Omelette + Veggies", emoji: "\uD83C\uDF73", cal: 180, protein_g: 22, carbs_g: 8, fat_g: 4, portion: "4 egg whites + veggies", slot: ["breakfast"], tags: ["non_veg", "keto", "high_protein", "low_carb"] },
];

// ── Lunch options ───────────────────────────────────────────────
export const LUNCH_MEALS: KBMeal[] = [
  { name: "Dal + Roti + Sabzi", emoji: "\uD83C\uDF5B", cal: 420, protein_g: 16, carbs_g: 56, fat_g: 12, portion: "1 bowl dal + 2 roti + sabzi", slot: ["lunch"], tags: ["veg", "vegan"] },
  { name: "Chicken Curry + Rice", emoji: "\uD83C\uDF5B", cal: 520, protein_g: 32, carbs_g: 52, fat_g: 16, portion: "150g chicken + 1 cup rice", slot: ["lunch"], tags: ["non_veg", "high_protein"] },
  { name: "Rajma Chawal", emoji: "\uD83C\uDF5A", cal: 440, protein_g: 18, carbs_g: 64, fat_g: 8, portion: "1 bowl rajma + 1 cup rice", slot: ["lunch"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Paneer Tikka + Salad", emoji: "\uD83E\uDDC0", cal: 380, protein_g: 24, carbs_g: 16, fat_g: 24, portion: "150g paneer + salad", slot: ["lunch"], tags: ["veg", "high_protein", "low_carb"] },
  { name: "Fish Curry + Rice", emoji: "\uD83C\uDF5B", cal: 460, protein_g: 30, carbs_g: 48, fat_g: 12, portion: "150g fish + 1 cup rice", slot: ["lunch"], tags: ["non_veg", "high_protein"] },
  { name: "Chole + 2 Roti", emoji: "\uD83C\uDF5B", cal: 430, protein_g: 16, carbs_g: 58, fat_g: 12, portion: "1 bowl chole + 2 roti", slot: ["lunch"], tags: ["veg", "vegan"] },
  { name: "Grilled Chicken Salad", emoji: "\uD83E\uDD57", cal: 350, protein_g: 35, carbs_g: 14, fat_g: 16, portion: "200g chicken + salad", slot: ["lunch"], tags: ["non_veg", "high_protein", "keto", "low_carb"] },
  { name: "Palak Paneer + Roti", emoji: "\uD83C\uDF5B", cal: 420, protein_g: 20, carbs_g: 38, fat_g: 18, portion: "1 bowl + 2 roti", slot: ["lunch"], tags: ["veg", "high_protein"] },
  { name: "Brown Rice + Sambhar + Papad", emoji: "\uD83C\uDF5A", cal: 400, protein_g: 14, carbs_g: 62, fat_g: 8, portion: "1 cup rice + sambhar", slot: ["lunch"], tags: ["veg", "vegan"] },
  { name: "Egg Curry + Roti", emoji: "\uD83C\uDF5B", cal: 400, protein_g: 22, carbs_g: 36, fat_g: 16, portion: "2 egg curry + 2 roti", slot: ["lunch"], tags: ["non_veg", "high_protein"] },
  { name: "Quinoa Pulao + Raita", emoji: "\uD83C\uDF5A", cal: 380, protein_g: 14, carbs_g: 52, fat_g: 10, portion: "1 cup quinoa + raita", slot: ["lunch"], tags: ["veg"] },
  { name: "Tofu Stir Fry + Rice", emoji: "\uD83C\uDF5A", cal: 390, protein_g: 20, carbs_g: 48, fat_g: 12, portion: "150g tofu + 1 cup rice", slot: ["lunch"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Dal Khichdi + Curd", emoji: "\uD83C\uDF5A", cal: 380, protein_g: 14, carbs_g: 56, fat_g: 8, portion: "1 bowl khichdi + curd", slot: ["lunch"], tags: ["veg"] },
  { name: "Chicken Biryani", emoji: "\uD83C\uDF5B", cal: 550, protein_g: 28, carbs_g: 60, fat_g: 18, portion: "1 plate (300g)", slot: ["lunch"], tags: ["non_veg", "high_protein"] },
  { name: "Kadhi + Rice", emoji: "\uD83C\uDF5A", cal: 380, protein_g: 10, carbs_g: 54, fat_g: 12, portion: "1 bowl kadhi + 1 cup rice", slot: ["lunch"], tags: ["veg"] },
  { name: "Keto Chicken Thighs + Greens", emoji: "\uD83C\uDF57", cal: 420, protein_g: 34, carbs_g: 6, fat_g: 28, portion: "200g chicken + sauteed greens", slot: ["lunch"], tags: ["non_veg", "keto", "high_protein", "low_carb"] },
  { name: "Paneer Bhurji + Low Carb Roti", emoji: "\uD83E\uDDC0", cal: 380, protein_g: 26, carbs_g: 14, fat_g: 24, portion: "150g paneer + 1 roti", slot: ["lunch"], tags: ["veg", "keto", "high_protein", "low_carb"] },
];

// ── Dinner options ──────────────────────────────────────────────
export const DINNER_MEALS: KBMeal[] = [
  { name: "Grilled Paneer + Veggies", emoji: "\uD83E\uDDC0", cal: 340, protein_g: 22, carbs_g: 14, fat_g: 22, portion: "150g paneer + veggies", slot: ["dinner"], tags: ["veg", "high_protein", "low_carb"] },
  { name: "Dal Tadka + 1 Roti", emoji: "\uD83C\uDF5B", cal: 320, protein_g: 14, carbs_g: 42, fat_g: 8, portion: "1 bowl dal + 1 roti", slot: ["dinner"], tags: ["veg", "vegan"] },
  { name: "Chicken Tikka + Salad", emoji: "\uD83C\uDF57", cal: 380, protein_g: 36, carbs_g: 10, fat_g: 20, portion: "200g tikka + salad", slot: ["dinner"], tags: ["non_veg", "high_protein", "keto", "low_carb"] },
  { name: "Vegetable Soup + Multigrain Toast", emoji: "\uD83C\uDF5C", cal: 220, protein_g: 8, carbs_g: 30, fat_g: 6, portion: "1 bowl soup + 2 toast", slot: ["dinner"], tags: ["veg", "vegan"] },
  { name: "Egg Fried Rice (Brown)", emoji: "\uD83C\uDF5A", cal: 380, protein_g: 16, carbs_g: 48, fat_g: 12, portion: "1 plate (250g)", slot: ["dinner"], tags: ["non_veg"] },
  { name: "Moong Dal Soup + Salad", emoji: "\uD83C\uDF5C", cal: 200, protein_g: 14, carbs_g: 26, fat_g: 4, portion: "1 bowl + salad", slot: ["dinner"], tags: ["veg", "vegan", "high_protein", "low_carb"] },
  { name: "Tandoori Roti + Mix Veg", emoji: "\uD83C\uDF5B", cal: 300, protein_g: 10, carbs_g: 42, fat_g: 8, portion: "2 roti + sabzi", slot: ["dinner"], tags: ["veg", "vegan"] },
  { name: "Grilled Fish + Steamed Veggies", emoji: "\uD83D\uDC1F", cal: 320, protein_g: 32, carbs_g: 12, fat_g: 14, portion: "200g fish + veggies", slot: ["dinner"], tags: ["non_veg", "high_protein", "keto", "low_carb"] },
  { name: "Palak Dal + Roti", emoji: "\uD83C\uDF5B", cal: 340, protein_g: 16, carbs_g: 40, fat_g: 10, portion: "1 bowl + 1 roti", slot: ["dinner"], tags: ["veg", "vegan"] },
  { name: "Chicken Soup + Bread", emoji: "\uD83C\uDF5C", cal: 280, protein_g: 22, carbs_g: 24, fat_g: 10, portion: "1 bowl soup + 1 bread", slot: ["dinner"], tags: ["non_veg", "high_protein"] },
  { name: "Mushroom Stir Fry + Quinoa", emoji: "\uD83C\uDF44", cal: 310, protein_g: 14, carbs_g: 38, fat_g: 10, portion: "150g mushroom + 1/2 cup quinoa", slot: ["dinner"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Paneer Tikka Wrap (Whole Wheat)", emoji: "\uD83C\uDF2F", cal: 360, protein_g: 20, carbs_g: 32, fat_g: 16, portion: "1 wrap", slot: ["dinner"], tags: ["veg", "high_protein"] },
  { name: "Keto Butter Chicken (no rice)", emoji: "\uD83C\uDF57", cal: 400, protein_g: 30, carbs_g: 8, fat_g: 28, portion: "200g chicken in gravy", slot: ["dinner"], tags: ["non_veg", "keto", "high_protein", "low_carb"] },
  { name: "Cauliflower Rice + Egg Bhurji", emoji: "\uD83C\uDF73", cal: 280, protein_g: 20, carbs_g: 10, fat_g: 18, portion: "1 bowl cauli rice + 2 eggs", slot: ["dinner"], tags: ["non_veg", "keto", "high_protein", "low_carb"] },
];

// ── Snack options ───────────────────────────────────────────────
export const SNACK_MEALS: KBMeal[] = [
  { name: "Mixed Nuts (Almonds, Walnuts)", emoji: "\uD83E\uDD5C", cal: 180, protein_g: 6, carbs_g: 8, fat_g: 14, portion: "30g handful", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan", "keto", "low_carb"] },
  { name: "Fruit Bowl (Seasonal)", emoji: "\uD83C\uDF53", cal: 120, protein_g: 2, carbs_g: 28, fat_g: 1, portion: "1 bowl (150g)", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan"] },
  { name: "Protein Shake (Whey)", emoji: "\uD83E\uDD5B", cal: 200, protein_g: 24, carbs_g: 12, fat_g: 4, portion: "1 scoop + milk", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "high_protein"] },
  { name: "Roasted Chana", emoji: "\uD83E\uDED8", cal: 150, protein_g: 8, carbs_g: 22, fat_g: 3, portion: "50g", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Buttermilk (Chaas)", emoji: "\uD83E\uDD5B", cal: 60, protein_g: 3, carbs_g: 6, fat_g: 2, portion: "1 glass (250ml)", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg"] },
  { name: "Apple + Peanut Butter", emoji: "\uD83C\uDF4E", cal: 220, protein_g: 6, carbs_g: 26, fat_g: 12, portion: "1 apple + 1 tbsp PB", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan"] },
  { name: "Boiled Egg (2)", emoji: "\uD83E\uDD5A", cal: 140, protein_g: 12, carbs_g: 2, fat_g: 10, portion: "2 eggs", slot: ["mid_morning_snack", "evening_snack"], tags: ["non_veg", "high_protein", "keto", "low_carb"] },
  { name: "Makhana (Fox Nuts)", emoji: "\uD83E\uDED8", cal: 130, protein_g: 4, carbs_g: 20, fat_g: 4, portion: "1 bowl (40g)", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan"] },
  { name: "Paneer Cubes (Grilled)", emoji: "\uD83E\uDDC0", cal: 200, protein_g: 16, carbs_g: 4, fat_g: 14, portion: "100g", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "high_protein", "keto", "low_carb"] },
  { name: "Green Tea + Biscuits", emoji: "\uD83C\uDF75", cal: 100, protein_g: 2, carbs_g: 16, fat_g: 3, portion: "1 cup + 2 biscuits", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg"] },
  { name: "Banana + Honey", emoji: "\uD83C\uDF4C", cal: 140, protein_g: 2, carbs_g: 34, fat_g: 1, portion: "1 banana + 1 tsp honey", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan"] },
  { name: "Yogurt + Chia Seeds", emoji: "\uD83E\uDD63", cal: 160, protein_g: 10, carbs_g: 14, fat_g: 6, portion: "150g yogurt + 1 tbsp chia", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "high_protein"] },
  { name: "Sprout Chaat", emoji: "\uD83E\uDD57", cal: 160, protein_g: 10, carbs_g: 22, fat_g: 4, portion: "1 bowl (100g)", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan", "high_protein"] },
  { name: "Dark Chocolate (2 squares)", emoji: "\uD83C\uDF6B", cal: 110, protein_g: 2, carbs_g: 10, fat_g: 8, portion: "20g", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg"] },
  { name: "Cheese Cubes + Cucumber", emoji: "\uD83E\uDDC0", cal: 150, protein_g: 8, carbs_g: 4, fat_g: 12, portion: "30g cheese + cucumber", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "keto", "low_carb"] },
  { name: "Trail Mix", emoji: "\uD83E\uDD5C", cal: 190, protein_g: 6, carbs_g: 16, fat_g: 12, portion: "35g", slot: ["mid_morning_snack", "evening_snack"], tags: ["veg", "vegan"] },
];

// ── Slot time mappings ──────────────────────────────────────────
export const SLOT_TIMES: Record<MealSlot, string> = {
  breakfast: "8:00 AM",
  mid_morning_snack: "10:30 AM",
  lunch: "1:00 PM",
  evening_snack: "4:30 PM",
  dinner: "7:30 PM",
};

// ── All meals indexed by slot ───────────────────────────────────
export function getMealsBySlot(slot: MealSlot): KBMeal[] {
  switch (slot) {
    case "breakfast": return BREAKFAST_MEALS;
    case "lunch": return LUNCH_MEALS;
    case "dinner": return DINNER_MEALS;
    case "mid_morning_snack":
    case "evening_snack": return SNACK_MEALS;
  }
}

// ── Filter meals by diet type ───────────────────────────────────
export function filterByDiet(meals: KBMeal[], dietType: string | null | undefined): KBMeal[] {
  const dt = (dietType || "").toLowerCase().replace(/_/g, " ");
  if (!dt || dt === "no preference") return meals;

  if (dt.includes("veg") && !dt.includes("non")) {
    return meals.filter((m) => m.tags.includes("veg"));
  }
  if (dt.includes("vegan")) {
    return meals.filter((m) => m.tags.includes("vegan"));
  }
  if (dt.includes("keto")) {
    return meals.filter((m) => m.tags.includes("keto"));
  }
  return meals;
}

// ── Filter meals by allergies ───────────────────────────────────
export function filterByAllergies(meals: KBMeal[], allergies: string | null | undefined): KBMeal[] {
  if (!allergies) return meals;
  const allergyList = allergies.toLowerCase().split(",").map((a) => a.trim());
  return meals.filter((meal) => {
    const lowerName = meal.name.toLowerCase();
    return !allergyList.some((a) => lowerName.includes(a));
  });
}
