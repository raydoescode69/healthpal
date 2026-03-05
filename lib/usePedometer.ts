import { useState, useEffect, useCallback, useRef } from "react";
import { Platform, AppState } from "react-native";

// ── Types ──────────────────────────────────────────────────
interface PedometerResult {
  steps: number;
  isAvailable: boolean;
  error: string | null;
  source: "health-connect" | "expo-sensors" | "none";
  refresh: () => void;
  connect: () => Promise<boolean>;
}

// ── Health Connect (Android prod builds) ───────────────────
async function tryHealthConnect(): Promise<{ steps: number; available: boolean }> {
  if (Platform.OS !== "android") return { steps: 0, available: false };

  try {
    const {
      initialize,
      requestPermission,
      readRecords,
      getSdkStatus,
      SdkAvailabilityStatus,
    } = require("react-native-health-connect");

    const initialized = await initialize();
    if (!initialized) return { steps: 0, available: false };

    const sdkStatus = await getSdkStatus();
    if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log("[HealthConnect] SDK not available, status:", sdkStatus);
      return { steps: 0, available: false };
    }

    // Request steps permission
    const permissions = await requestPermission([
      { accessType: "read", recordType: "Steps" },
    ]);

    const hasStepsPermission = permissions.some(
      (p: any) => p.recordType === "Steps" && p.accessType === "read"
    );

    if (!hasStepsPermission) {
      console.log("[HealthConnect] Steps permission denied");
      return { steps: 0, available: false };
    }

    // Read today's steps
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const { records } = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });

    const totalSteps = (records || []).reduce(
      (sum: number, record: any) => sum + (record.count || 0),
      0
    );

    console.log("[HealthConnect] Today's steps:", totalSteps);
    return { steps: totalSteps, available: true };
  } catch (err: any) {
    // Health Connect not available (e.g., in Expo Go or older Android)
    console.log("[HealthConnect] Not available:", err?.message);
    return { steps: 0, available: false };
  }
}

// ── Expo Sensors fallback ──────────────────────────────────
async function tryExpoSensors(): Promise<{ steps: number; available: boolean }> {
  try {
    const { Pedometer } = require("expo-sensors");

    const available = await Pedometer.isAvailableAsync();
    if (!available) return { steps: 0, available: false };

    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== "granted") return { steps: 0, available: false };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();

    const result = await Pedometer.getStepCountAsync(start, end);
    return { steps: result.steps, available: true };
  } catch (err: any) {
    console.log("[ExpoSensors] Not available:", err?.message);
    return { steps: 0, available: false };
  }
}

// ── Main hook ──────────────────────────────────────────────
export function usePedometer(): PedometerResult {
  const [steps, setSteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<PedometerResult["source"]>("none");
  const appState = useRef(AppState.currentState);

  const fetchSteps = useCallback(async () => {
    // Try Health Connect first (Android prod builds)
    if (Platform.OS === "android") {
      const hc = await tryHealthConnect();
      if (hc.available) {
        setSteps(hc.steps);
        setIsAvailable(true);
        setSource("health-connect");
        setError(null);
        return;
      }
    }

    // Fallback to expo-sensors
    const sensors = await tryExpoSensors();
    if (sensors.available) {
      setSteps(sensors.steps);
      setIsAvailable(true);
      setSource("expo-sensors");
      setError(null);
      return;
    }

    setIsAvailable(false);
    setSource("none");
    setError("Step tracking not available");
  }, []);

  useEffect(() => {
    fetchSteps();

    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        fetchSteps();
      }
      appState.current = nextState;
    });

    // Refresh every 5 minutes while active
    const interval = setInterval(fetchSteps, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [fetchSteps]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      const hc = await tryHealthConnect();
      if (hc.available) {
        setSteps(hc.steps);
        setIsAvailable(true);
        setSource("health-connect");
        setError(null);
        return true;
      }
      setError("Health Connect not available. Make sure the Health Connect app is installed.");
      return false;
    }

    const sensors = await tryExpoSensors();
    if (sensors.available) {
      setSteps(sensors.steps);
      setIsAvailable(true);
      setSource("expo-sensors");
      setError(null);
      return true;
    }

    setError("Step tracking not available on this device.");
    return false;
  }, []);

  return { steps, isAvailable, error, source, refresh: fetchSteps, connect };
}
