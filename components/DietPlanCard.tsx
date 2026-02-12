import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { DietPlanData, DietMeal } from "../lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MacroBadge({ label, value, color }: { label: string; value?: number; color: string }) {
  if (value == null) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 3 }} />
      <Text style={{ color: "#888", fontSize: 11 }}>
        {label} {value}g
      </Text>
    </View>
  );
}

function MealRow({ meal }: { meal: DietMeal }) {
  const hasMacros = meal?.protein_g != null || meal?.carbs_g != null || meal?.fat_g != null;

  return (
    <View style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Emoji circle */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#222",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14 }}>{meal?.emoji || "\uD83C\uDF7D\uFE0F"}</Text>
        </View>

        {/* Name + time + portion */}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}
            numberOfLines={1}
          >
            {meal?.name || "Meal"}
          </Text>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 1 }}>
            {meal?.time || ""}
            {meal?.portion ? `  •  ${meal.portion}` : ""}
          </Text>
        </View>

        {/* Calories */}
        <Text style={{ color: "#A8FF3E", fontSize: 13, fontWeight: "bold" }}>
          {meal?.cal ?? 0} cal
        </Text>
      </View>

      {/* Macro badges */}
      {hasMacros && (
        <View style={{ flexDirection: "row", marginLeft: 38, marginTop: 4 }}>
          <MacroBadge label="P" value={meal.protein_g} color="#4FC3F7" />
          <MacroBadge label="C" value={meal.carbs_g} color="#FFB74D" />
          <MacroBadge label="F" value={meal.fat_g} color="#E57373" />
        </View>
      )}
    </View>
  );
}

export default function DietPlanCard({
  plan,
  onPersonalize,
}: {
  plan: DietPlanData | null;
  onPersonalize?: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState(0);

  if (!plan) return null;

  const days = plan?.days ?? [];
  const currentDay = days?.[selectedDay] ?? days?.[0];
  const meals = currentDay?.meals ?? [];
  const totalCal = meals.reduce((sum, m) => sum + (m?.cal ?? 0), 0);
  const totalP = meals.reduce((sum, m) => sum + (m?.protein_g ?? 0), 0);
  const totalC = meals.reduce((sum, m) => sum + (m?.carbs_g ?? 0), 0);
  const totalF = meals.reduce((sum, m) => sum + (m?.fat_g ?? 0), 0);
  const hasDailyMacros = plan.daily_protein_g || plan.daily_carbs_g || plan.daily_fat_g;
  const hasMealMacros = totalP > 0 || totalC > 0 || totalF > 0;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ marginBottom: 12, marginHorizontal: 4 }}>
      <View
        style={{
          backgroundColor: "#161616",
          borderWidth: 1,
          borderColor: "#2a5a2a",
          borderRadius: 16,
          padding: 16,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
            {"\uD83E\uDD57"} Your 7-Day Plan
          </Text>
          {!plan?.is_personalized && onPersonalize && (
            <Pressable onPress={onPersonalize} style={{ opacity: 1 }}>
              <Text style={{ color: "#A8FF3E", fontSize: 12 }}>
                Personalize →
              </Text>
            </Pressable>
          )}
        </View>

        {/* Day selector row */}
        {days.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {days.map((_day, i) => {
              const isActive = i === selectedDay;
              const label = DAY_LABELS[i] || _day?.day?.slice(0, 3) || "?";
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDay(i)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isActive ? "#A8FF3E" : "#222",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? "bold" : "normal",
                      color: isActive ? "#000" : "#888",
                    }}
                  >
                    {label.charAt(0)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Meals list */}
        <View style={{ marginTop: 12 }}>
          {meals.length > 0 ? (
            meals.map((meal, i) => (
              <View key={i}>
                <MealRow meal={meal} />
                {i < meals.length - 1 && (
                  <View style={{ height: 1, backgroundColor: "#222" }} />
                )}
              </View>
            ))
          ) : (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ color: "#555", fontSize: 13 }}>
                No meals for this day
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#222",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#666", fontSize: 13 }}>Total</Text>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>
              ~{totalCal} cal/day
            </Text>
          </View>

          {/* Daily macro totals */}
          {hasMealMacros && (
            <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "center", gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4FC3F7", marginRight: 4 }} />
                <Text style={{ color: "#aaa", fontSize: 12 }}>Protein {totalP}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFB74D", marginRight: 4 }} />
                <Text style={{ color: "#aaa", fontSize: 12 }}>Carbs {totalC}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E57373", marginRight: 4 }} />
                <Text style={{ color: "#aaa", fontSize: 12 }}>Fat {totalF}g</Text>
              </View>
            </View>
          )}

          {/* Target macros from plan */}
          {hasDailyMacros && !hasMealMacros && (
            <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "center", gap: 16 }}>
              {plan.daily_protein_g ? (
                <Text style={{ color: "#666", fontSize: 11 }}>Target P: {plan.daily_protein_g}g</Text>
              ) : null}
              {plan.daily_carbs_g ? (
                <Text style={{ color: "#666", fontSize: 11 }}>C: {plan.daily_carbs_g}g</Text>
              ) : null}
              {plan.daily_fat_g ? (
                <Text style={{ color: "#666", fontSize: 11 }}>F: {plan.daily_fat_g}g</Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
