import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const asyncStoreStorage = createJSONStorage(() => AsyncStorage);

interface ThemeState {
  mode: "dark" | "light";
  setMode: (mode: "dark" | "light") => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "dark" ? "light" : "dark" })),
    }),
    {
      name: "theme-store",
      storage: asyncStoreStorage,
    }
  )
);
