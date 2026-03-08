import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Challenge, ChallengeParticipant } from "../lib/types";

interface BetsState {
  challenges: Challenge[];
  activeChallenge: Challenge | null;
  participants: ChallengeParticipant[];
  isLoading: boolean;

  loadChallenges: (userId: string) => Promise<void>;
  loadChallenge: (challengeId: string) => Promise<void>;
  createChallenge: (
    userId: string,
    data: { title: string; metric: string; target: number; expires_at: string }
  ) => Promise<void>;
  updateProgress: (participantId: string, value: number) => Promise<void>;
  clearBets: () => void;
}

export const useBetsStore = create<BetsState>()((set) => ({
  challenges: [],
  activeChallenge: null,
  participants: [],
  isLoading: false,

  loadChallenges: async (userId: string) => {
    set({ isLoading: true });
    try {
      // Get challenges where user is creator
      const { data: created, error: e1 } = await supabase
        .from("challenges")
        .select("*")
        .eq("creator_id", userId);

      if (e1) throw e1;

      // Get challenges where user is participant
      const { data: participated, error: e2 } = await supabase
        .from("challenge_participants")
        .select("challenge_id")
        .eq("user_id", userId);

      if (e2) throw e2;

      const participatedIds = (participated || []).map(
        (p: { challenge_id: string }) => p.challenge_id
      );

      let participatedChallenges: Challenge[] = [];
      if (participatedIds.length > 0) {
        const { data, error: e3 } = await supabase
          .from("challenges")
          .select("*")
          .in("id", participatedIds);

        if (e3) throw e3;
        participatedChallenges = (data as Challenge[]) || [];
      }

      // Merge and deduplicate
      const allChallenges = [...(created || []), ...participatedChallenges];
      const seen = new Set<string>();
      const unique = allChallenges.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      set({ challenges: unique as Challenge[], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadChallenge: async (challengeId: string) => {
    set({ isLoading: true });
    try {
      const { data: challenge, error: e1 } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (e1) throw e1;

      const { data: parts, error: e2 } = await supabase
        .from("challenge_participants")
        .select("*")
        .eq("challenge_id", challengeId);

      if (e2) throw e2;

      set({
        activeChallenge: challenge as Challenge,
        participants: (parts as ChallengeParticipant[]) || [],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  createChallenge: async (
    userId: string,
    data: { title: string; metric: string; target: number; expires_at: string }
  ) => {
    set({ isLoading: true });
    try {
      const { data: challenge, error: e1 } = await supabase
        .from("challenges")
        .insert({ creator_id: userId, ...data })
        .select()
        .single();

      if (e1) throw e1;

      // Add creator as first participant
      await supabase
        .from("challenge_participants")
        .insert({ challenge_id: challenge.id, user_id: userId });

      set((s) => ({
        challenges: [...s.challenges, challenge as Challenge],
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  updateProgress: async (participantId: string, value: number) => {
    try {
      const { error } = await supabase
        .from("challenge_participants")
        .update({ current_value: value })
        .eq("id", participantId);

      if (error) throw error;

      set((s) => ({
        participants: s.participants.map((p) =>
          p.id === participantId ? { ...p, current_value: value } : p
        ),
      }));
    } catch {}
  },

  clearBets: () =>
    set({ challenges: [], activeChallenge: null, participants: [] }),
}));
