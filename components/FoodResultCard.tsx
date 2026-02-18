import { useState } from "react";
import { View, Text, Pressable, TextInput, Image, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
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

const CONFIDENCE_CONFIG = {
  high: { label: "High Confidence", color: "#4CAF50", icon: "checkmark-circle" as const },
  medium: { label: "Medium Confidence", color: "#FFB74D", icon: "alert-circle" as const },
  low: { label: "Low Confidence", color: "#E57373", icon: "warning" as const },
};

interface FoodResultCardProps {
  result: FoodAnalysisResult;
  imageUri?: string;
  onConfirm: (edited: FoodAnalysisResult) => void;
  onRetake: () => void;
}

export default function FoodResultCard({
  result,
  imageUri,
  onConfirm,
  onRetake,
}: FoodResultCardProps) {
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const [editing, setEditing] = useState(false);
  const [calories, setCalories] = useState(String(result.calories));
  const [protein, setProtein] = useState(String(result.protein_g));
  const [carbs, setCarbs] = useState(String(result.carbs_g));
  const [fat, setFat] = useState(String(result.fat_g));

  const confidence = result.confidence || "medium";
  const confConfig = CONFIDENCE_CONFIG[confidence];
  const emoji = MEAL_EMOJIS[result.meal_type?.toLowerCase() ?? ""] ?? "\uD83C\uDF7D\uFE0F";
  const mealLabel = result.meal_type
    ? result.meal_type.charAt(0).toUpperCase() + result.meal_type.slice(1)
    : "Meal";

  const handleConfirm = () => {
    const edited: FoodAnalysisResult = {
      ...result,
      calories: Math.round(Number(calories) || 0),
      protein_g: Math.round(Number(protein) || 0),
      carbs_g: Math.round(Number(carbs) || 0),
      fat_g: Math.round(Number(fat) || 0),
    };
    onConfirm(edited);
  };

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <View
        style={{
          backgroundColor: colors.widgetBg,
          borderWidth: 1,
          borderColor: colors.accentBorder,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* Image preview */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: 200, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            resizeMode="cover"
          />
        )}

        <View style={{ padding: 18 }}>
          {/* Confidence badge */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                backgroundColor: confConfig.color + "20",
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginBottom: 14,
              }}
            >
              <Ionicons name={confConfig.icon} size={14} color={confConfig.color} />
              <Text style={{ color: confConfig.color, fontSize: 12, fontWeight: "600", marginLeft: 5 }}>
                {confConfig.label}
                {result.confidence_score ? ` (${result.confidence_score}%)` : ""}
              </Text>
            </View>
          </Animated.View>

          {/* Food name + meal badge */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 24, marginRight: 10 }}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700" }}
                numberOfLines={2}
              >
                {result.food_name}
              </Text>
              {result.portion_size && (
                <Text style={{ color: colors.subText, fontSize: 13, marginTop: 2 }}>
                  {result.portion_size}
                </Text>
              )}
            </View>
            <View
              style={{
                backgroundColor: colors.accentDark,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
                {mealLabel}
              </Text>
            </View>
          </View>

          {/* Meal items breakdown */}
          {result.meal_items && result.meal_items.length > 1 && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
                contentContainerStyle={{ gap: 6 }}
              >
                {result.meal_items.map((item, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: colors.widgetBorder,
                      borderRadius: 14,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item}</Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Big calorie number */}
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Text
              style={{
                color: colors.accent,
                fontSize: 36,
                fontWeight: "800",
                marginBottom: 16,
              }}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {editing ? calories : result.calories} cal
            </Text>
          </Animated.View>

          {/* Macro bars */}
          <Animated.View entering={FadeInDown.delay(400).duration(300)}>
            {editing ? (
              <View style={{ gap: 10, marginBottom: 16 }}>
                <MacroEditRow
                  label="Protein"
                  value={protein}
                  onChange={setProtein}
                  color="#4FC3F7"
                  colors={colors}
                />
                <MacroEditRow
                  label="Carbs"
                  value={carbs}
                  onChange={setCarbs}
                  color="#FFB74D"
                  colors={colors}
                />
                <MacroEditRow
                  label="Fat"
                  value={fat}
                  onChange={setFat}
                  color="#E57373"
                  colors={colors}
                />
                <MacroEditRow
                  label="Calories"
                  value={calories}
                  onChange={setCalories}
                  color={colors.accent}
                  colors={colors}
                />
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <MacroDisplay label="Protein" value={result.protein_g} unit="g" color="#4FC3F7" colors={colors} />
                <MacroDisplay label="Carbs" value={result.carbs_g} unit="g" color="#FFB74D" colors={colors} />
                <MacroDisplay label="Fat" value={result.fat_g} unit="g" color="#E57373" colors={colors} />
              </View>
            )}
          </Animated.View>

          {/* Action buttons */}
          <Animated.View entering={FadeInDown.delay(500).duration(300)}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Edit / Done toggle */}
              <Pressable
                onPress={() => setEditing(!editing)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.widgetBorder,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name={editing ? "checkmark" : "create-outline"}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600", marginLeft: 6 }}>
                    {editing ? "Done" : "Edit"}
                  </Text>
                </View>
              </Pressable>

              {/* Retake */}
              <Pressable
                onPress={onRetake}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.widgetBorder,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600", marginLeft: 6 }}>
                    Retake
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Confirm & Log */}
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.accentDark : colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 10,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={18} color={mode === "dark" ? "#000" : "#fff"} />
                <Text style={{ color: mode === "dark" ? "#000" : "#fff", fontSize: 15, fontWeight: "700", marginLeft: 6 }}>
                  Confirm & Log
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

function MacroDisplay({
  label,
  value,
  unit,
  color,
  colors,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  colors: typeof THEMES.dark;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 6 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
        {label}{" "}
        <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
          {value}{unit}
        </Text>
      </Text>
    </View>
  );
}

function MacroEditRow({
  label,
  value,
  onChange,
  color,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  colors: typeof THEMES.dark;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 14, width: 70 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={{
          flex: 1,
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          color: colors.textPrimary,
          fontSize: 15,
          fontWeight: "600",
        }}
        selectTextOnFocus
      />
      <Text style={{ color: colors.subText, fontSize: 13, marginLeft: 6 }}>
        {label === "Calories" ? "cal" : "g"}
      </Text>
    </View>
  );
}
