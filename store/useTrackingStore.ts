import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { FoodLog, FoodAnalysisResult } from "../lib/types";

interface DailySummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface TrackingState {
  foodLogs: FoodLog[];
  waterGlasses: number;
  isLoading: boolean;
  lastResetDate: string;

  loadTodayLogs: (userId: string) => Promise<void>;
  saveFoodLog: (
    userId: string,
    result: FoodAnalysisResult,
    imageUrl?: string | null
  ) => Promise<FoodLog | null>;
  deleteFoodLog: (logId: string) => Promise<void>;
  getDailySummary: () => DailySummary;
  addWater: (count: number) => void;
  resetIfNewDay: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const useTrackingStore = create<TrackingState>()((set, get) => ({
  foodLogs: [],
  waterGlasses: 0,
  isLoading: false,
  lastResetDate: todayStr(),

  loadTodayLogs: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("logged_at", todayStart())
        .order("logged_at", { ascending: true });

      if (error) throw error;
      set({ foodLogs: (data as FoodLog[]) || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveFoodLog: async (
    userId: string,
    result: FoodAnalysisResult,
    imageUrl?: string | null
  ) => {
    try {
      const row = {
        user_id: userId,
        food_name: result.food_name,
        calories: result.calories,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        meal_type: result.meal_type,
        image_url: imageUrl || null,
        logged_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("food_logs")
        .insert(row)
        .select()
        .single();

      if (error) throw error;

      const created = data as FoodLog;
      set((s) => ({ foodLogs: [...s.foodLogs, created] }));
      return created;
    } catch {
      return null;
    }
  },

  deleteFoodLog: async (logId: string) => {
    try {
      await supabase.from("food_logs").delete().eq("id", logId);
      set((s) => ({ foodLogs: s.foodLogs.filter((l) => l.id !== logId) }));
    } catch {}
  },

  getDailySummary: () => {
    const { foodLogs } = get();
    return foodLogs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.calories,
        protein_g: acc.protein_g + log.protein_g,
        carbs_g: acc.carbs_g + log.carbs_g,
        fat_g: acc.fat_g + log.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  },

  addWater: (count) => {
    get().resetIfNewDay();
    set((s) => ({ waterGlasses: s.waterGlasses + count }));
  },

  resetIfNewDay: () => {
    const today = todayStr();
    if (get().lastResetDate !== today) {
      set({ waterGlasses: 0, foodLogs: [], lastResetDate: today });
    }
  },
}));
