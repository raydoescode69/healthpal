import { create } from "zustand";
import type { Challenge } from "../lib/types";
import {
  createChallenge as createChallengeService,
  loadUserChallenges,
  loadChallengeDetail,
  subscribeToChallenge,
  resolveExpiredChallenges,
  type EnrichedParticipant,
} from "../lib/betsService";

interface BetsState {
  challenges: Challenge[];
  activeChallenge: Challenge | null;
  participants: EnrichedParticipant[];
  isLoading: boolean;
  _unsubscribe: (() => void) | null;

  loadChallenges: (userId: string) => Promise<void>;
  loadChallenge: (challengeId: string) => Promise<void>;
  createChallenge: (
    userId: string,
    data: { title: string; metric: Challenge["metric"]; target: number }
  ) => Promise<Challenge | null>;
  subscribeToActive: (challengeId: string) => void;
  unsubscribeFromActive: () => void;
  clearBets: () => void;
}

export const useBetsStore = create<BetsState>()((set, get) => ({
  challenges: [],
  activeChallenge: null,
  participants: [],
  isLoading: false,
  _unsubscribe: null,

  loadChallenges: async (userId: string) => {
    set({ isLoading: true });
    try {
      const challenges = await loadUserChallenges(userId);
      set({ challenges, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadChallenge: async (challengeId: string) => {
    set({ isLoading: true });
    try {
      const { challenge, participants } = await loadChallengeDetail(challengeId);
      set({ activeChallenge: challenge, participants, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createChallenge: async (
    userId: string,
    data: { title: string; metric: Challenge["metric"]; target: number }
  ) => {
    set({ isLoading: true });
    try {
      const challenge = await createChallengeService(userId, data);
      set((s) => ({
        challenges: [...s.challenges, challenge],
        isLoading: false,
      }));
      return challenge;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  subscribeToActive: (challengeId: string) => {
    const prev = get()._unsubscribe;
    if (prev) prev();

    const unsubscribe = subscribeToChallenge(challengeId, (participants) => {
      set({ participants });
    });
    set({ _unsubscribe: unsubscribe });
  },

  unsubscribeFromActive: () => {
    const unsub = get()._unsubscribe;
    if (unsub) unsub();
    set({ _unsubscribe: null });
  },

  clearBets: () => {
    const unsub = get()._unsubscribe;
    if (unsub) unsub();
    set({
      challenges: [],
      activeChallenge: null,
      participants: [],
      _unsubscribe: null,
    });
  },
}));
