import { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import type { FoodLog } from "../../lib/types";

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "\uD83C\uDF73",
  lunch: "\uD83C\uDF5B",
  snack: "\uD83C\uDF6A",
  dinner: "\uD83C\uDF5D",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function calculateTargets(profile: any) {
  if (!profile?.weight || !profile?.height || !profile?.age) {
    return { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  }
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  const tdee = bmr * 1.55;
  const goal = (profile.goal || "").toLowerCase();
  let cal = Math.round(tdee);
  if (goal.includes("lose")) cal = Math.round(tdee - 500);
  if (goal.includes("gain") || goal.includes("muscle")) cal = Math.round(tdee + 400);

  let pPct = 0.3, cPct = 0.4, fPct = 0.3;
  if (goal.includes("lose")) { pPct = 0.35; cPct = 0.35; fPct = 0.3; }
  if (goal.includes("gain") || goal.includes("muscle")) { pPct = 0.35; cPct = 0.45; fPct = 0.2; }
  if (goal.includes("keto")) { pPct = 0.3; cPct = 0.1; fPct = 0.6; }

  return {
    calories: cal,
    protein: Math.round((cal * pPct) / 4),
    carbs: Math.round((cal * cPct) / 4),
    fat: Math.round((cal * fPct) / 9),
  };
}

function ProgressBar({
  current,
  target,
  color,
}: {
  current: number;
  target: number;
  color: string;
}) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View
      style={{
        height: 6,
        backgroundColor: "#1A1A1A",
        borderRadius: 3,
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <View
        style={{
          height: 6,
          width: `${pct}%`,
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  );
}

function FoodLogRow({ item }: { item: FoodLog }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#1A1A1A",
      }}
    >
      <Text style={{ fontSize: 24, marginRight: 12 }}>
        {MEAL_EMOJI[item.meal_type] || "\uD83C\uDF7D\uFE0F"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {item.food_name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <Text style={{ color: "#666", fontSize: 11 }}>
            {formatTime(item.logged_at)}
          </Text>
          <View style={{ flexDirection: "row", marginLeft: 10, gap: 6 }}>
            <Text style={{ color: "#4FC3F7", fontSize: 10, fontWeight: "600" }}>
              {item.protein_g}g P
            </Text>
            <Text style={{ color: "#FFB74D", fontSize: 10, fontWeight: "600" }}>
              {item.carbs_g}g C
            </Text>
            <Text style={{ color: "#E57373", fontSize: 10, fontWeight: "600" }}>
              {item.fat_g}g F
            </Text>
          </View>
        </View>
      </View>
      <Text style={{ color: "#A8FF3E", fontSize: 15, fontWeight: "700" }}>
        {item.calories}
      </Text>
      <Text style={{ color: "#666", fontSize: 11, marginLeft: 2 }}>cal</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { foodLogs, isLoading, loadTodayLogs, getDailySummary } =
    useTrackingStore();

  const userId = session?.user?.id || "";
  const targets = calculateTargets(profile);
  const summary = getDailySummary();

  useEffect(() => {
    if (userId) loadTodayLogs(userId);
  }, [userId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "#151515",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#888", fontSize: 22 }}>{"\u2190"}</Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: "#fff",
            fontSize: 17,
            fontWeight: "600",
          }}
        >
          Today's Nutrition
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={foodLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FoodLogRow item={item} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            {/* Calorie card */}
            <View
              style={{
                backgroundColor: "#111",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "#1C1C1C",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>
                Calories
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                }}
              >
                <Text
                  style={{
                    color: "#A8FF3E",
                    fontSize: 40,
                    fontWeight: "700",
                  }}
                >
                  {summary.calories}
                </Text>
                <Text style={{ color: "#555", fontSize: 16, marginLeft: 6 }}>
                  / {targets.calories}
                </Text>
              </View>
              <ProgressBar
                current={summary.calories}
                target={targets.calories}
                color="#A8FF3E"
              />
            </View>

            {/* Macro cards */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              {/* Protein */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#111",
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#1C1C1C",
                }}
              >
                <Text style={{ color: "#4FC3F7", fontSize: 11, fontWeight: "600" }}>
                  Protein
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.protein_g}
                  <Text style={{ color: "#555", fontSize: 13 }}>
                    /{targets.protein}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.protein_g}
                  target={targets.protein}
                  color="#4FC3F7"
                />
              </View>

              {/* Carbs */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#111",
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#1C1C1C",
                }}
              >
                <Text style={{ color: "#FFB74D", fontSize: 11, fontWeight: "600" }}>
                  Carbs
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.carbs_g}
                  <Text style={{ color: "#555", fontSize: 13 }}>
                    /{targets.carbs}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.carbs_g}
                  target={targets.carbs}
                  color="#FFB74D"
                />
              </View>

              {/* Fat */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#111",
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#1C1C1C",
                }}
              >
                <Text style={{ color: "#E57373", fontSize: 11, fontWeight: "600" }}>
                  Fat
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.fat_g}
                  <Text style={{ color: "#555", fontSize: 13 }}>
                    /{targets.fat}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.fat_g}
                  target={targets.fat}
                  color="#E57373"
                />
              </View>
            </View>

            {/* Section header */}
            <Text
              style={{
                color: "#666",
                fontSize: 12,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Food Log
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color="#A8FF3E" size="small" />
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>{"\uD83C\uDF7D\uFE0F"}</Text>
              <Text style={{ color: "#555", fontSize: 15, textAlign: "center" }}>
                No food logged yet today
              </Text>
              <Text style={{ color: "#444", fontSize: 13, textAlign: "center", marginTop: 4 }}>
                Tap "Log Food" in chat to start tracking
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />
    </View>
  );
}
