import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { AuraScore } from "../lib/types";

interface AuraState {
  score: AuraScore | null;
  isLoading: boolean;
  error: string | null;

  loadTodayScore: (userId: string) => Promise<void>;
  saveScore: (
    userId: string,
    score: Omit<AuraScore, "id" | "user_id" | "created_at">
  ) => Promise<void>;
  clearScore: () => void;
}

export const useAuraStore = create<AuraState>()((set) => ({
  score: null,
  isLoading: false,
  error: null,

  loadTodayScore: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("aura_scores")
        .select("*")
        .eq("user_id", userId)
        .eq("scored_at", today)
        .maybeSingle();

      if (error) throw error;
      set({ score: data as AuraScore | null, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || "Failed to load score", isLoading: false });
    }
  },

  saveScore: async (
    userId: string,
    score: Omit<AuraScore, "id" | "user_id" | "created_at">
  ) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("aura_scores")
        .upsert(
          { user_id: userId, ...score },
          { onConflict: "user_id,scored_at" }
        )
        .select()
        .single();

      if (error) throw error;
      set({ score: data as AuraScore, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || "Failed to save score", isLoading: false });
    }
  },

  clearScore: () => set({ score: null, error: null }),
}));
