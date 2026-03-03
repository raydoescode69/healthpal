export interface UserProfile {
  id: string;
  name: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  goal: string;
  diet_type: string;
  allergies?: string;
  language_style?: string;
  timezone?: string;
  created_at?: string;
}

export interface OnboardingData {
  name: string;
  age: string;
  weight_kg: string;
  height_cm: string;
  goal: string;
  diet_type: string;
}

export const GENDERS = [
  { id: "male", label: "Male", icon: "👨" },
  { id: "female", label: "Female", icon: "👩" },
  { id: "other", label: "Other", icon: "🧑" },
] as const;

export const GOALS = [
  { id: "lose_weight", label: "Lose Weight", icon: "🔥" },
  { id: "gain_muscle", label: "Gain Muscle", icon: "💪" },
  { id: "eat_healthy", label: "Eat Healthy", icon: "🥗" },
  { id: "manage_stress", label: "Manage Stress", icon: "🧘" },
] as const;

export const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", icon: "🪑", desc: "Desk job, little exercise" },
  { id: "light", label: "Lightly Active", icon: "🚶", desc: "Light exercise 1-3 days/week" },
  { id: "moderate", label: "Moderately Active", icon: "🏃", desc: "Exercise 3-5 days/week" },
  { id: "very_active", label: "Very Active", icon: "💪", desc: "Hard exercise 6-7 days/week" },
] as const;

export const WORK_TIMINGS = [
  { id: "morning", label: "Morning Shift", icon: "🌅", desc: "6 AM - 2 PM" },
  { id: "regular", label: "Regular Hours", icon: "☀️", desc: "9 AM - 6 PM" },
  { id: "evening", label: "Evening Shift", icon: "🌆", desc: "2 PM - 10 PM" },
  { id: "night", label: "Night Shift", icon: "🌙", desc: "10 PM - 6 AM" },
  { id: "flexible", label: "Flexible / WFH", icon: "🏠", desc: "Variable hours" },
] as const;

export interface Message {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const QUICK_ACTIONS = [
  { label: "Diet Plan", icon: "diet-plan" },
  { label: "Log Food", icon: "track-calories" },
] as const;

export const DIET_TYPES = [
  { id: "veg", label: "Vegetarian", icon: "🥦" },
  { id: "non_veg", label: "Non-Veg", icon: "🍗" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "keto", label: "Keto", icon: "🥑" },
  { id: "no_preference", label: "No Preference", icon: "🍽️" },
] as const;

// ── Diet Plan types ──────────────────────────────────────────
export interface DietMeal {
  emoji: string;
  name: string;
  time: string;
  cal: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  portion?: string;
}

export interface DietDay {
  day: string;
  meals: DietMeal[];
}

export interface DietPlanData {
  type: "DIET_PLAN";
  is_personalized: boolean;
  daily_calories: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
  days: DietDay[];
}

export interface ParsedBotResponse {
  bubbles: string[];
  dietPlan?: DietPlanData;
  foodLogResult?: FoodAnalysisResult;
}

// ── Food tracking types ──────────────────────────────────────
export interface FoodLog {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string;
  image_url?: string | null;
  logged_at: string;
}

export interface FoodAnalysisResult {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string;
  confidence?: "high" | "medium" | "low";
  confidence_score?: number;
  portion_size?: string;
  meal_items?: string[];
}

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
}

export interface PinnedMessage {
  id: string;
  conversation_id: string;
  message_id: string;
  user_id: string;
  pinned_at: string;
}
