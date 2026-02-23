import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { useTrackingStore } from "../store/useTrackingStore";
import {
  showCalorieNotification,
  updateCalorieNotification,
  dismissCalorieNotification,
} from "./androidNotificationService";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useAndroidNotification() {
  if (Platform.OS !== "android") return;

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;

    const getSummary = () => useTrackingStore.getState().getDailySummary();

    // Show notification on mount
    showCalorieNotification(getSummary(), profile);

    // Subscribe to foodLogs changes in Zustand store
    const unsubscribe = useTrackingStore.subscribe(
      (state, prevState) => {
        if (state.foodLogs !== prevState.foodLogs) {
          updateCalorieNotification(getSummary(), profile);
        }
      }
    );

    // Periodic refresh for meal reminder text transitions
    intervalRef.current = setInterval(() => {
      updateCalorieNotification(getSummary(), profile);
    }, REFRESH_INTERVAL_MS);

    // Refresh on app foreground
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        updateCalorieNotification(getSummary(), profile);
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSubscription.remove();
      dismissCalorieNotification();
    };
  }, [session, profile]);
}
