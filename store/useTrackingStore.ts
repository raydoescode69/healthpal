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
  selectedDate: string;
  loggedDates: Set<string>;

  loadTodayLogs: (userId: string) => Promise<void>;
  loadLogsForDate: (userId: string, dateStr: string) => Promise<void>;
  loadLoggedDates: (userId: string, year: number, month: number) => Promise<void>;
  setSelectedDate: (dateStr: string) => void;
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
  selectedDate: todayStr(),
  loggedDates: new Set<string>(),

  loadTodayLogs: async (userId: string) => {
    set({ isLoading: true, selectedDate: todayStr() });
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

  loadLogsForDate: async (userId: string, dateStr: string) => {
    set({ isLoading: true, selectedDate: dateStr });
    try {
      const dayStart = new Date(dateStr + "T00:00:00").toISOString();
      const dayEnd = new Date(dateStr + "T23:59:59.999").toISOString();
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("logged_at", dayStart)
        .lte("logged_at", dayEnd)
        .order("logged_at", { ascending: true });

      if (error) throw error;
      set({ foodLogs: (data as FoodLog[]) || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadLoggedDates: async (userId: string, year: number, month: number) => {
    try {
      const monthStart = new Date(year, month - 1, 1).toISOString();
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const { data, error } = await supabase
        .from("food_logs")
        .select("logged_at")
        .eq("user_id", userId)
        .gte("logged_at", monthStart)
        .lte("logged_at", monthEnd);

      if (error) throw error;

      const dates = new Set<string>(get().loggedDates);
      (data || []).forEach((row: { logged_at: string }) => {
        dates.add(row.logged_at.slice(0, 10));
      });
      set({ loggedDates: dates });
    } catch {}
  },

  setSelectedDate: (dateStr: string) => {
    set({ selectedDate: dateStr });
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
