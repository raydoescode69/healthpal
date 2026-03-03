import { create } from "zustand";

interface ThemeState {
  mode: "dark" | "light";
  setMode: (mode: "dark" | "light") => void;
  syncWithSystem: (systemMode: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  mode: "dark",
  setMode: (mode) => set({ mode }),
  syncWithSystem: (systemMode) => set({ mode: systemMode }),
}));
