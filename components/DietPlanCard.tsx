import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { DietPlanData, DietMeal } from "../lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MealRow({ meal }: { meal: DietMeal }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
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

      {/* Name + time */}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}
          numberOfLines={1}
        >
          {meal?.name || "Meal"}
        </Text>
        <Text style={{ color: "#666", fontSize: 12, marginTop: 1 }}>
          {meal?.time || ""}
        </Text>
      </View>

      {/* Calories */}
      <Text style={{ color: "#A8FF3E", fontSize: 13, fontWeight: "bold" }}>
        {meal?.cal ?? 0} cal
      </Text>
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
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#666", fontSize: 13 }}>Total</Text>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>
            ~{totalCal} cal/day
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
