export interface UserProfile {
  id: string;
  name: string;
  age: number;
  weight: number;
  height: number;
  goal: string;
  diet_type: string;
  allergies?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingData {
  name: string;
  age: string;
  weight: string;
  height: string;
  goal: string;
  diet_type: string;
}

export const GOALS = [
  { id: "lose_weight", label: "Lose Weight", icon: "🔥" },
  { id: "gain_muscle", label: "Gain Muscle", icon: "💪" },
  { id: "eat_healthy", label: "Eat Healthy", icon: "🥗" },
  { id: "manage_stress", label: "Manage Stress", icon: "🧘" },
] as const;

export interface Message {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const QUICK_ACTIONS = [
  { label: "Log Food", icon: "🍎" },
  { label: "My Plan", icon: "📋" },
  { label: "Motivate me", icon: "💪" },
  { label: "Water intake", icon: "💧" },
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
