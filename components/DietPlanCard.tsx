import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../lib/theme";
import type { DietPlanData, DietMeal } from "../lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MacroBadge({ label, value, color, textColor }: { label: string; value?: number; color: string; textColor: string }) {
  if (value == null) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 3 }} />
      <Text style={{ color: textColor, fontSize: 11 }}>
        {label} {value}g
      </Text>
    </View>
  );
}

function MealRow({ meal, colors }: { meal: DietMeal; colors: typeof THEMES.dark }) {
  const hasMacros = meal?.protein_g != null || meal?.carbs_g != null || meal?.fat_g != null;

  return (
    <View style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.widgetBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14 }}>{meal?.emoji || "\uD83C\uDF7D\uFE0F"}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}
            numberOfLines={1}
          >
            {meal?.name || "Meal"}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 12, marginTop: 1 }}>
            {meal?.time || ""}
            {meal?.portion ? `  \u2022  ${meal.portion}` : ""}
          </Text>
        </View>

        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "bold" }}>
          {meal?.cal ?? 0} cal
        </Text>
      </View>

      {hasMacros && (
        <View style={{ flexDirection: "row", marginLeft: 38, marginTop: 4 }}>
          <MacroBadge label="P" value={meal.protein_g} color="#4FC3F7" textColor={colors.textTertiary} />
          <MacroBadge label="C" value={meal.carbs_g} color="#FFB74D" textColor={colors.textTertiary} />
          <MacroBadge label="F" value={meal.fat_g} color="#E57373" textColor={colors.textTertiary} />
        </View>
      )}
    </View>
  );
}

export default function DietPlanCard({
  plan,
  onPersonalize,
  onLongPress,
  isPinned,
}: {
  plan: DietPlanData | null;
  onPersonalize?: () => void;
  onLongPress?: () => void;
  isPinned?: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState(0);
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

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
      <Pressable
        onLongPress={() => {
          if (onLongPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onLongPress();
          }
        }}
        delayLongPress={400}
      >
      <View
        style={{
          backgroundColor: colors.widgetBg,
          borderWidth: isPinned ? 1.5 : 1,
          borderColor: isPinned ? colors.accent : colors.accentBorder,
          borderRadius: 16,
          padding: 16,
        }}
      >
        {isPinned && (
          <Text style={{ color: colors.accent, fontSize: 10, marginBottom: 6 }}>
            {"\uD83D\uDCCC"} Pinned
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "bold" }}>
            {"\uD83E\uDD57"} Your 7-Day Plan
          </Text>
          {!plan?.is_personalized && onPersonalize && (
            <Pressable onPress={onPersonalize} style={{ opacity: 1 }}>
              <Text style={{ color: colors.accent, fontSize: 12 }}>
                Personalize {"\u2192"}
              </Text>
            </Pressable>
          )}
        </View>

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
                    backgroundColor: isActive ? colors.accent : colors.widgetBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? "bold" : "normal",
                      color: isActive ? "#000" : colors.textTertiary,
                    }}
                  >
                    {label.charAt(0)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ marginTop: 12 }}>
          {meals.length > 0 ? (
            meals.map((meal, i) => (
              <View key={i}>
                <MealRow meal={meal} colors={colors} />
                {i < meals.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.widgetBorder }} />
                )}
              </View>
            ))
          ) : (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                No meals for this day
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.widgetBorder,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.subText, fontSize: 13 }}>Total</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "bold" }}>
              ~{totalCal} cal/day
            </Text>
          </View>

          {hasMealMacros && (
            <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "center", gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4FC3F7", marginRight: 4 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Protein {totalP}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFB74D", marginRight: 4 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Carbs {totalC}g</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E57373", marginRight: 4 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Fat {totalF}g</Text>
              </View>
            </View>
          )}

          {hasDailyMacros && !hasMealMacros && (
            <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "center", gap: 16 }}>
              {plan.daily_protein_g ? (
                <Text style={{ color: colors.subText, fontSize: 11 }}>Target P: {plan.daily_protein_g}g</Text>
              ) : null}
              {plan.daily_carbs_g ? (
                <Text style={{ color: colors.subText, fontSize: 11 }}>C: {plan.daily_carbs_g}g</Text>
              ) : null}
              {plan.daily_fat_g ? (
                <Text style={{ color: colors.subText, fontSize: 11 }}>F: {plan.daily_fat_g}g</Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
      </Pressable>
    </Animated.View>
  );
}
