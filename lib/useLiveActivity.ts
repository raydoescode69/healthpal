import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { useTrackingStore } from "../store/useTrackingStore";
import {
  startCalorieActivity,
  updateCalorieActivity,
  endCalorieActivity,
  hasActiveActivity,
} from "./liveActivityService";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useLiveActivity() {
  if (Platform.OS !== "ios") return;

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;

    const getSummary = () => useTrackingStore.getState().getDailySummary();

    // Start activity on mount
    startCalorieActivity(getSummary(), profile);

    // Subscribe to foodLogs changes in Zustand store
    const unsubscribe = useTrackingStore.subscribe(
      (state, prevState) => {
        if (state.foodLogs !== prevState.foodLogs) {
          updateCalorieActivity(getSummary(), profile);
        }
      }
    );

    // Periodic refresh for meal reminder transitions
    intervalRef.current = setInterval(() => {
      updateCalorieActivity(getSummary(), profile);
    }, REFRESH_INTERVAL_MS);

    // Refresh on app foreground
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const summary = getSummary();
        if (hasActiveActivity()) {
          updateCalorieActivity(summary, profile);
        } else {
          // Activity expired while backgrounded — restart
          startCalorieActivity(summary, profile);
        }
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSubscription.remove();
      endCalorieActivity(getSummary(), profile);
    };
  }, [session, profile]);
}
