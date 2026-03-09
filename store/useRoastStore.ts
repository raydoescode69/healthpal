import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Roast } from "../lib/types";

interface RoastState {
  roast: Roast | null;
  isLoading: boolean;

  loadTodayRoast: (userId: string) => Promise<void>;
  saveRoast: (
    userId: string,
    roast: Omit<Roast, "id" | "user_id" | "created_at">
  ) => Promise<void>;
  clearRoast: () => void;
}

export const useRoastStore = create<RoastState>()((set) => ({
  roast: null,
  isLoading: false,

  loadTodayRoast: async (userId: string) => {
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("roasts")
        .select("*")
        .eq("user_id", userId)
        .eq("scored_at", today)
        .maybeSingle();

      if (error) throw error;
      set({ roast: data as Roast | null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveRoast: async (
    userId: string,
    roast: Omit<Roast, "id" | "user_id" | "created_at">
  ) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("roasts")
        .upsert(
          { user_id: userId, ...roast },
          { onConflict: "user_id,scored_at" }
        )
        .select()
        .single();

      if (error) throw error;
      set({ roast: data as Roast, isLoading: false });
    } catch (e) {
      console.warn("[RoastStore] saveRoast failed:", e);
      // Set roast from input to prevent infinite retry loop
      set({
        roast: {
          id: "",
          user_id: userId,
          created_at: new Date().toISOString(),
          ...roast,
        } as Roast,
        isLoading: false,
      });
    }
  },

  clearRoast: () => set({ roast: null }),
}));
