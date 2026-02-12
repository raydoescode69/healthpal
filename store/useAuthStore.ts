import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "../lib/types";

const asyncStoreStorage = createJSONStorage(() => AsyncStorage);

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      profile: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      logout: () => set({ session: null, user: null, profile: null }),
    }),
    {
      name: "auth-store",
      storage: asyncStoreStorage,
    }
  )
);
