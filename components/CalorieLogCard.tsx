import { View, Text, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../lib/theme";
import type { FoodAnalysisResult } from "../lib/types";

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: "\uD83C\uDF73",
  lunch: "\uD83C\uDF5B",
  dinner: "\uD83C\uDF5D",
  snack: "\uD83C\uDF6A",
};

export default function CalorieLogCard({
  result,
  onViewDashboard,
}: {
  result: FoodAnalysisResult;
  onViewDashboard: () => void;
}) {
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];
  const emoji = MEAL_EMOJIS[result.meal_type?.toLowerCase() ?? ""] ?? "\uD83C\uDF7D\uFE0F";
  const mealLabel = result.meal_type
    ? result.meal_type.charAt(0).toUpperCase() + result.meal_type.slice(1)
    : "Meal";

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ marginBottom: 10, paddingHorizontal: 16, alignItems: "flex-start" }}>
      <View
        style={{
          width: "88%",
          backgroundColor: colors.widgetBg,
          borderWidth: 1,
          borderColor: colors.accentBorder,
          borderRadius: 16,
          padding: 16,
        }}
      >
        {/* Confidence badge */}
        {result.confidence && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: (result.confidence === "high" ? "#4CAF50" : result.confidence === "medium" ? "#FFB74D" : "#E57373") + "20",
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: result.confidence === "high" ? "#4CAF50" : result.confidence === "medium" ? "#FFB74D" : "#E57373", fontSize: 10, fontWeight: "600" }}>
              {result.confidence === "high" ? "\u2713" : result.confidence === "medium" ? "\u26A0" : "\u2022"} {result.confidence_score ?? ""}% match
            </Text>
          </View>
        )}

        {/* Header: emoji + food name + meal badge */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
              {result.food_name}
            </Text>
            {result.portion_size && (
              <Text style={{ color: colors.subText, fontSize: 11, marginTop: 2 }}>{result.portion_size}</Text>
            )}
          </View>
          <View
            style={{
              backgroundColor: colors.accentDark,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "600" }}>
              {mealLabel}
            </Text>
          </View>
        </View>

        {/* Meal items */}
        {result.meal_items && result.meal_items.length > 1 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {result.meal_items.map((item, i) => (
              <View key={i} style={{ backgroundColor: colors.widgetBorder, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Macro row */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#4FC3F7", marginRight: 4 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>P {result.protein_g}g</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFB74D", marginRight: 4 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>C {result.carbs_g}g</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#E57373", marginRight: 4 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>F {result.fat_g}g</Text>
          </View>
        </View>

        {/* Big calorie number */}
        <Text
          style={{ color: colors.accent, fontSize: 26, fontWeight: "800", marginBottom: 12 }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {result.calories} cal
        </Text>

        {/* View Dashboard button */}
        <Pressable
          onPress={onViewDashboard}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.accentDark : "transparent",
            borderWidth: 1,
            borderColor: colors.accentBorder,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: "center",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600", marginRight: 4 }}>
              View Dashboard
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accent} />
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}
