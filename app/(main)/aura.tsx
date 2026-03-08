import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { useThemeStore } from "../../store/useThemeStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useAuraStore } from "../../store/useAuraStore";
import { THEMES } from "../../lib/theme";
import { usePedometer } from "../../lib/usePedometer";
import {
  calculateAuraScore,
  getAuraColor,
  type AuraResult,
} from "../../lib/auraCalculator";

import AuraOrb from "../../components/AuraOrb";
import AuraShareCard from "../../components/AuraShareCard";

// ── Stat row config ──────────────────────────────────────────
const STAT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sleep: "moon-outline",
  Nutrition: "nutrition-outline",
  Movement: "footsteps-outline",
  Hydration: "water-outline",
};

function formatSteps(steps: number): string {
  return steps.toLocaleString("en-US");
}

// ── Component ────────────────────────────────────────────────
export default function AuraScreen() {
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  // Tracking data
  const loadTodayLogs = useTrackingStore((s) => s.loadTodayLogs);
  const getDailySummary = useTrackingStore((s) => s.getDailySummary);
  const waterGlasses = useTrackingStore((s) => s.waterGlasses);
  const foodLogs = useTrackingStore((s) => s.foodLogs);

  // Pedometer
  const { steps } = usePedometer();

  // Aura store
  const auraStore = useAuraStore();

  // Share card ref
  const shareCardRef = useRef<View>(null);

  // Local state
  const [isCalculating, setIsCalculating] = useState(true);
  const [auraResult, setAuraResult] = useState<AuraResult | null>(null);

  // Load data on mount
  useEffect(() => {
    if (!userId) return;
    loadTodayLogs(userId);
    auraStore.loadTodayScore(userId);
  }, [userId]);

  // Calculate score when data changes
  useEffect(() => {
    if (!userId) {
      setIsCalculating(false);
      return;
    }

    const summary = getDailySummary();
    const hasData =
      summary.calories > 0 || waterGlasses > 0 || steps > 0;

    if (!hasData) {
      setAuraResult(null);
      setIsCalculating(false);
      return;
    }

    const result = calculateAuraScore({
      calories: summary.calories,
      protein_g: summary.protein_g,
      carbs_g: summary.carbs_g,
      fat_g: summary.fat_g,
      waterGlasses,
      steps,
      sleepHours: 7, // hardcoded until sleep tracking is built
    });

    setAuraResult(result);
    setIsCalculating(false);

    // Save to Supabase
    const today = new Date().toISOString().slice(0, 10);
    auraStore.saveScore(userId, {
      score: result.score,
      sleep_score: result.sleepScore,
      nutrition_score: result.nutritionScore,
      movement_score: result.movementScore,
      hydration_score: result.hydrationScore,
      label: result.label,
      scored_at: today,
    });
  }, [userId, foodLogs, waterGlasses, steps]);

  // Derived values
  const score = auraResult?.score ?? 0;
  const auraColor = getAuraColor(score);
  const hasData = auraResult !== null;

  // Stat rows data
  const statRows = useMemo(() => {
    if (!auraResult) return [];
    return [
      {
        name: "Sleep",
        score: auraResult.sleepScore,
        value: "7h",
      },
      {
        name: "Nutrition",
        score: auraResult.nutritionScore,
        value: `${auraResult.nutritionScore}%`,
      },
      {
        name: "Movement",
        score: auraResult.movementScore,
        value: formatSteps(steps),
      },
      {
        name: "Hydration",
        score: auraResult.hydrationScore,
        value: `${waterGlasses}/8`,
      },
    ];
  }, [auraResult, steps, waterGlasses]);

  // Share handler
  const handleShare = async () => {
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
      });
      await Sharing.shareAsync(uri);
    } catch (e) {
      console.error("Share failed:", e);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBg }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.brandPill}>
          <Text style={styles.brandText}>Nyra</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {isCalculating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !hasData ? (
        /* No data state */
        <View style={styles.emptyContainer}>
          <Ionicons name="sparkles" size={48} color={colors.accent} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Track your first meal to get your Aura Score
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Log food, water, or steps to see your daily health aura
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/chat")}
            style={[styles.ctaButton, { backgroundColor: colors.accent }]}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="chatbubble-outline" size={18} color="#000" />
              <Text style={styles.ctaText}>Start Tracking</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        /* Main aura screen */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Orb */}
          <View style={styles.orbSection}>
            <AuraOrb score={score} color={auraColor} size={240} />
          </View>

          {/* Label */}
          <Text style={[styles.label, { color: auraColor }]}>
            {auraResult!.label}
          </Text>
          <Text style={styles.description}>{auraResult!.description}</Text>

          {/* Stats */}
          <View style={styles.statsSection}>
            {statRows.map((stat) => (
              <View key={stat.name} style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons
                    name={STAT_ICONS[stat.name]}
                    size={16}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.statName}>{stat.name}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: auraColor,
                        width: `${Math.min(100, stat.score)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Share button */}
          <Pressable
            onPress={handleShare}
            style={[styles.shareButton, { backgroundColor: auraColor }]}
          >
            <View style={styles.shareInner}>
              <Ionicons name="share-outline" size={18} color="#000" />
              <Text style={styles.shareText}>Share My Aura</Text>
            </View>
          </Pressable>
        </ScrollView>
      )}

      {/* Off-screen share card for captureRef */}
      {hasData && (
        <View
          style={{ position: "absolute", left: -9999 }}
          collapsable={false}
        >
          <View ref={shareCardRef} collapsable={false}>
            <AuraShareCard
              score={score}
              label={auraResult!.label}
              sleepScore={auraResult!.sleepScore}
              nutritionScore={auraResult!.nutritionScore}
              movementScore={auraResult!.movementScore}
              hydrationScore={auraResult!.hydrationScore}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  brandPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  ctaButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 40,
  },
  orbSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  description: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    maxWidth: 280,
    marginTop: 8,
    lineHeight: 18,
  },
  statsSection: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 36,
    gap: 18,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 100,
  },
  statName: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    width: 50,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
    textAlign: "right",
  },
  shareButton: {
    marginTop: 36,
    marginHorizontal: 24,
    width: "85%",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shareInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
});
