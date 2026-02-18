import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES, type ThemeColors } from "../../lib/theme";
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

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateHeader(dateStr: string): string {
  const today = toDateStr(new Date());
  if (dateStr === today) return "Today's Nutrition";
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} Nutrition`;
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
  trackColor,
}: {
  current: number;
  target: number;
  color: string;
  trackColor: string;
}) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View
      style={{
        height: 6,
        backgroundColor: trackColor,
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

function FoodLogRow({ item, colors }: { item: FoodLog; colors: ThemeColors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      <View style={{ width: 32, marginRight: 12, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24 }}>
          {MEAL_EMOJI[item.meal_type] || "\uD83C\uDF7D\uFE0F"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {item.food_name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <Text style={{ color: colors.subText, fontSize: 11 }}>
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
      <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700" }}>
        {item.calories}
      </Text>
      <Text style={{ color: colors.subText, fontSize: 11, marginLeft: 2 }}>cal</Text>
    </View>
  );
}

function getCalendarTheme(colors: ThemeColors) {
  return {
    backgroundColor: "transparent",
    calendarBackground: "transparent",
    textSectionTitleColor: colors.subText,
    selectedDayBackgroundColor: colors.accent,
    selectedDayTextColor: "#000",
    todayTextColor: colors.accent,
    todayBackgroundColor: colors.accentDark,
    dayTextColor: colors.textSecondary,
    textDisabledColor: colors.textFaint,
    dotColor: colors.accent,
    selectedDotColor: "#000",
    arrowColor: colors.accent,
    monthTextColor: colors.textPrimary,
    textMonthFontWeight: "700" as const,
    textMonthFontSize: 16,
    textDayFontSize: 14,
    textDayHeaderFontSize: 12,
    textDayFontWeight: "500" as const,
    textDayHeaderFontWeight: "600" as const,
    "stylesheet.calendar.header": {
      week: {
        flexDirection: "row" as const,
        justifyContent: "space-around" as const,
        marginTop: 4,
        marginBottom: 4,
      },
    },
  };
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];
  const {
    foodLogs,
    isLoading,
    loadTodayLogs,
    loadLogsForDate,
    loadLoggedDates,
    selectedDate,
    loggedDates,
    getDailySummary,
  } = useTrackingStore();

  const [calendarOpen, setCalendarOpen] = useState(false);

  const userId = session?.user?.id || "";
  const targets = calculateTargets(profile);
  const summary = getDailySummary();
  const todayDateStr = toDateStr(new Date());
  const calendarTheme = useMemo(() => getCalendarTheme(colors), [mode]);

  // Load today's logs + current month's logged dates on mount
  useEffect(() => {
    if (!userId) return;
    loadTodayLogs(userId);
    const now = new Date();
    loadLoggedDates(userId, now.getFullYear(), now.getMonth() + 1);
  }, [userId]);

  const handleDayPress = useCallback((day: DateData) => {
    if (!userId) return;
    const dateStr = day.dateString;
    if (dateStr === todayDateStr) {
      loadTodayLogs(userId);
    } else {
      loadLogsForDate(userId, dateStr);
    }
    setCalendarOpen(false);
  }, [userId, todayDateStr, loadTodayLogs, loadLogsForDate]);

  const handleMonthChange = useCallback((month: DateData) => {
    if (!userId) return;
    const y = month.year;
    const m = month.month;
    loadLoggedDates(userId, y, m);
  }, [userId, loadLoggedDates]);

  // Build marked dates for the calendar
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    loggedDates.forEach((dateStr) => {
      marks[dateStr] = {
        marked: true,
        dotColor: colors.accent,
      };
    });

    if (marks[selectedDate]) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: colors.accent,
        selectedTextColor: "#000",
      };
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: colors.accent,
        selectedTextColor: "#000",
      };
    }

    if (todayDateStr !== selectedDate) {
      if (marks[todayDateStr]) {
        marks[todayDateStr] = {
          ...marks[todayDateStr],
          today: true,
        };
      }
    }

    return marks;
  }, [loggedDates, selectedDate, todayDateStr, colors.accent]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: colors.headerBorder,
          backgroundColor: colors.headerBg,
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
          <Text style={{ color: colors.textTertiary, fontSize: 22 }}>{"\u2190"}</Text>
        </Pressable>
        <Pressable
          onPress={() => setCalendarOpen((v) => !v)}
          style={{ flex: 1, alignItems: "center" }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {formatDateHeader(selectedDate)}
          </Text>
          <Text style={{ color: colors.accent, fontSize: 11, marginTop: 2 }}>
            {calendarOpen ? "Tap to close" : "Tap for calendar"} {calendarOpen ? "\u25B2" : "\u25BC"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (userId) loadTodayLogs(userId);
            setCalendarOpen(false);
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: selectedDate === todayDateStr ? colors.textMuted : colors.accent, fontSize: 12, fontWeight: "700" }}>
            Today
          </Text>
        </Pressable>
      </View>

      {/* Expandable Calendar */}
      {calendarOpen && (
        <View style={{ backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, paddingBottom: 8 }}>
          <Calendar
            current={selectedDate}
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            markedDates={markedDates}
            maxDate={todayDateStr}
            theme={calendarTheme}
            enableSwipeMonths
            hideExtraDays
          />
          {/* Legend */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, paddingTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 4 }} />
              <Text style={{ color: colors.subText, fontSize: 11 }}>Food logged</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textFaint, marginRight: 4 }} />
              <Text style={{ color: colors.subText, fontSize: 11 }}>No data</Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={foodLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FoodLogRow item={item} colors={colors} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            {/* Calorie card */}
            <View
              style={{
                backgroundColor: colors.cardBg,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 4 }}>
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
                    color: colors.accent,
                    fontSize: 40,
                    fontWeight: "700",
                  }}
                >
                  {summary.calories}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 16, marginLeft: 6 }}>
                  / {targets.calories}
                </Text>
              </View>
              <ProgressBar
                current={summary.calories}
                target={targets.calories}
                color={colors.accent}
                trackColor={colors.progressBarBg}
              />
            </View>

            {/* Macro cards */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              {/* Protein */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.cardBg,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <Text style={{ color: "#4FC3F7", fontSize: 11, fontWeight: "600" }}>
                  Protein
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.protein_g}
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    /{targets.protein}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.protein_g}
                  target={targets.protein}
                  color="#4FC3F7"
                  trackColor={colors.progressBarBg}
                />
              </View>

              {/* Carbs */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.cardBg,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <Text style={{ color: "#FFB74D", fontSize: 11, fontWeight: "600" }}>
                  Carbs
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.carbs_g}
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    /{targets.carbs}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.carbs_g}
                  target={targets.carbs}
                  color="#FFB74D"
                  trackColor={colors.progressBarBg}
                />
              </View>

              {/* Fat */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.cardBg,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <Text style={{ color: "#E57373", fontSize: 11, fontWeight: "600" }}>
                  Fat
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: "700",
                    marginTop: 4,
                  }}
                >
                  {summary.fat_g}
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    /{targets.fat}g
                  </Text>
                </Text>
                <ProgressBar
                  current={summary.fat_g}
                  target={targets.fat}
                  color="#E57373"
                  trackColor={colors.progressBarBg}
                />
              </View>
            </View>

            {/* Section header */}
            <Text
              style={{
                color: colors.subText,
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
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>{"\uD83C\uDF7D\uFE0F"}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: "center" }}>
                {selectedDate === todayDateStr
                  ? "No food logged yet today"
                  : "No food logged on this day"}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 13, textAlign: "center", marginTop: 4 }}>
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
