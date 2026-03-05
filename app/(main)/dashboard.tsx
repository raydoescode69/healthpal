import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES, type ThemeColors } from "../../lib/theme";
import { calculateTargets } from "../../lib/nutritionUtils";
import { Ionicons } from "@expo/vector-icons";
import ActivityRings from "../../components/ActivityRings";
import { usePedometer } from "../../lib/usePedometer";
import { getMealIcon } from "../../lib/mealIcons";
import type { FoodLog } from "../../lib/types";

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FoodLogRow({ item, colors, onDelete }: { item: FoodLog; colors: ThemeColors; onDelete: () => void }) {
  const mealIcon = getMealIcon(item.meal_type);
  const mealLabel = capitalize(item.meal_type);

  const handleDelete = () => {
    Alert.alert(
      "Remove food log",
      `Delete "${item.food_name}" (${item.calories} kcal)?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]
    );
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      <Ionicons name={mealIcon as any} size={22} color={colors.accent} style={{ marginRight: 12 }} />
      <Text
        style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500", flex: 1 }}
        numberOfLines={1}
      >
        {mealLabel}: {item.food_name} - {item.calories} kcal
      </Text>
      <Pressable
        onPress={handleDelete}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.5 : 0.6,
          padding: 6,
        })}
      >
        <Ionicons name="trash-outline" size={18} color="#E57373" />
      </Pressable>
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
    deleteFoodLog,
    waterGlasses,
    steps,
    stepGoal,
  } = useTrackingStore();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const pedometer = usePedometer();

  const userId = session?.user?.id || "";
  const targets = calculateTargets(profile);
  const summary = getDailySummary();
  const todayDateStr = toDateStr(new Date());
  const calendarTheme = useMemo(() => getCalendarTheme(colors), [mode]);

  // Use real pedometer steps when available, fall back to manual tracking
  const displaySteps = pedometer.isAvailable ? pedometer.steps : steps;

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
          <Ionicons name="arrow-back" size={22} color={colors.textTertiary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            Dashboard
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => setCalendarOpen((v) => !v)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={calendarOpen ? "calendar" : "calendar-outline"}
              size={20}
              color={colors.accent}
            />
          </Pressable>
        </View>
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
        renderItem={({ item }) => <FoodLogRow item={item} colors={colors} onDelete={() => deleteFoodLog(item.id)} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            {/* NUTR. DASHBOARD card */}
            <View
              style={{
                backgroundColor: colors.cardBg,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginBottom: 20,
              }}
            >
              {/* Card title */}
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 }}>
                NUTRITION DASHBOARD
              </Text>

              <ActivityRings
                calories={summary.calories}
                calorieTarget={targets.calories}
                protein={summary.protein_g}
                proteinTarget={targets.protein}
                steps={displaySteps}
                stepTarget={stepGoal}
                water={waterGlasses}
                waterTarget={8}
                textColor={colors.textPrimary}
                subTextColor={colors.subText}
                mode={mode}
              />
            </View>

            {/* FOOD LOG HISTORY header with date bubble */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                {selectedDate === todayDateStr ? "TODAY'S FOOD LOG" : formatDateHeader(selectedDate).replace("Nutrition", "FOOD LOG").toUpperCase()}
              </Text>
              <Pressable
                onPress={() => setCalendarOpen((v) => !v)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.accentDark || colors.accent + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={calendarOpen ? "calendar" : "calendar-outline"}
                  size={16}
                  color={colors.accent}
                />
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 32 }}>
              <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
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
