import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES, type ThemeColors } from "../../lib/theme";
import { calculateTargets } from "../../lib/nutritionUtils";
import { Ionicons } from "@expo/vector-icons";
import { usePedometer } from "../../lib/usePedometer";
import type { FoodLog } from "../../lib/types";

// ── Accent colors (shared across themes) ────────────
const LIME = "#bef135";
const LIME_DARK = "#5BAA22"; // for light mode accent
const SKY = "#38bdf8";
const ORANGE = "#fb923c";

// ── Theme-derived color helpers ─────────────────────
function getT(mode: "dark" | "light") {
  const isDark = mode === "dark";
  return {
    bg: isDark ? "#07070a" : "#f0ede8",
    surface: isDark ? "#111210" : "#fff",
    accent: isDark ? LIME : LIME_DARK,
    text: (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(12,10,8,${a})`,
    calNum: isDark ? "#fff" : "#0c0a08",
    statCardBg: isDark ? "rgba(255,255,255,0.04)" : "#fff",
    statCardBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(12,10,8,0.08)",
    waterBg: isDark ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.08)",
    waterBorder: isDark ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.15)",
    foodBorder: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,10,8,0.06)",
    icoBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(12,10,8,0.06)",
    glowColor: isDark ? "rgba(190,241,53,0.15)" : "rgba(190,241,53,0.1)",
    donutTrack: isDark ? "rgba(255,255,255,0.07)" : "rgba(12,10,8,0.08)",
    barTrack: isDark ? "rgba(255,255,255,0.07)" : "rgba(12,10,8,0.07)",
  };
}

// ── Helpers ─────────────────────────────────────────
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getMealEmoji(mealType: string): string {
  const map: Record<string, string> = {
    breakfast: "🥣",
    lunch: "🥗",
    dinner: "🍽️",
    snack: "🍌",
  };
  return map[(mealType || "").toLowerCase()] ?? "🍽️";
}

// ── Donut Chart ─────────────────────────────────────
function DonutChart({ percent, trackColor }: { percent: number; trackColor: string }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * Math.min(percent, 100)) / 100;

  return (
    <View style={{ width: 72, height: 72, position: "relative" }}>
      <Svg width={72} height={72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={r} fill="none" stroke={trackColor} strokeWidth={6} />
        <Circle
          cx={36} cy={36} r={r}
          fill="none" stroke={LIME} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          rotation={-90} origin="36,36"
          opacity={0.85}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutPct}>{Math.round(percent)}%</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
//  DASHBOARD — D1 BENTO ENERGY (theme-aware)
// ════════════════════════════════════════════════════
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];
  const t = useMemo(() => getT(mode), [mode]);
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

  const calendarTheme = useMemo(() => ({
    backgroundColor: "transparent",
    calendarBackground: "transparent",
    textSectionTitleColor: t.text(0.4),
    selectedDayBackgroundColor: t.accent,
    selectedDayTextColor: mode === "dark" ? "#000" : "#fff",
    todayTextColor: t.accent,
    todayBackgroundColor: t.accent + "18",
    dayTextColor: t.text(0.7),
    textDisabledColor: t.text(0.2),
    dotColor: t.accent,
    selectedDotColor: mode === "dark" ? "#000" : "#fff",
    arrowColor: t.accent,
    monthTextColor: t.text(0.8),
    textMonthFontWeight: "700" as const,
    textMonthFontSize: 16,
    textDayFontSize: 14,
    textDayHeaderFontSize: 12,
    textDayFontWeight: "500" as const,
    textDayHeaderFontWeight: "600" as const,
    "stylesheet.calendar.header": {
      week: { flexDirection: "row" as const, justifyContent: "space-around" as const, marginTop: 4, marginBottom: 4 },
    },
  }), [mode]);

  const displaySteps = pedometer.isAvailable ? pedometer.steps : steps;
  const calPercent = targets.calories > 0 ? (summary.calories / targets.calories) * 100 : 0;
  const proteinPercent = targets.protein > 0 ? (summary.protein_g / targets.protein) * 100 : 0;
  const stepsPercent = stepGoal > 0 ? (displaySteps / stepGoal) * 100 : 0;
  const remaining = Math.max(0, targets.calories - summary.calories);
  const onTrack = calPercent <= 100;

  useEffect(() => {
    if (!userId) return;
    loadTodayLogs(userId);
    const now = new Date();
    loadLoggedDates(userId, now.getFullYear(), now.getMonth() + 1);
  }, [userId]);

  const handleDayPress = useCallback(
    (day: DateData) => {
      if (!userId) return;
      if (day.dateString === todayDateStr) loadTodayLogs(userId);
      else loadLogsForDate(userId, day.dateString);
      setCalendarOpen(false);
    },
    [userId, todayDateStr]
  );

  const handleMonthChange = useCallback(
    (month: DateData) => {
      if (!userId) return;
      loadLoggedDates(userId, month.year, month.month);
    },
    [userId]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    loggedDates.forEach((d) => {
      marks[d] = { marked: true, dotColor: t.accent };
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: t.accent,
      selectedTextColor: mode === "dark" ? "#000" : "#fff",
    };
    return marks;
  }, [loggedDates, selectedDate, mode]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* ── Top bar ─────────────────────────────── */}
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={t.text(0.35)} />
        </Pressable>
        <Text style={[styles.title, { color: t.text(0.8) }]}>Dashboard</Text>
        <View style={styles.topRight}>
          <Pressable
            onPress={() => router.push("/(main)/edit-profile")}
            style={[styles.ico, { backgroundColor: t.icoBg }]}
          >
            <Ionicons name="settings-outline" size={14} color={t.text(0.4)} />
          </Pressable>
          <Pressable
            onPress={() => setCalendarOpen((v) => !v)}
            style={[styles.ico, { backgroundColor: t.icoBg }]}
          >
            <Ionicons
              name={calendarOpen ? "calendar" : "calendar-outline"}
              size={14}
              color={calendarOpen ? t.accent : t.text(0.4)}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Calendar ────────────────────────────── */}
      {calendarOpen && (
        <View style={[styles.calendarWrap, { backgroundColor: t.surface, borderBottomColor: t.foodBorder }]}>
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
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* ── Bento Grid ───────────────────────── */}
        <View style={styles.bento}>
          {/* Big Calorie Card */}
          <View style={[styles.calCard, { backgroundColor: t.surface }]}>
            <View style={[styles.calGlow, { backgroundColor: t.glowColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: t.text(0.28) }]}>CALORIES TODAY</Text>
              <Text style={[styles.calNum, { color: t.calNum }]}>
                {summary.calories.toLocaleString()}{" "}
                <Text style={[styles.calOf, { color: t.text(0.35) }]}>
                  / {targets.calories.toLocaleString()}
                </Text>
              </Text>
              <Text style={[styles.calLabel, { color: t.text(0.35) }]}>
                {remaining.toLocaleString()} remaining · {onTrack ? "on track 🟢" : "over budget 🔴"}
              </Text>
            </View>
            <DonutChart percent={calPercent} trackColor={t.donutTrack} />
          </View>

          {/* Protein + Steps row */}
          <View style={styles.statRow}>
            {/* Protein */}
            <View style={[styles.statCard, { backgroundColor: t.statCardBg, borderColor: t.statCardBorder }]}>
              <View style={styles.scHead}>
                <View style={[styles.scIcon, { backgroundColor: LIME + "1A" }]}>
                  <Ionicons name="flash" size={13} color={LIME} />
                </View>
                <Text style={[styles.scPct, { color: LIME }]}>{Math.round(proteinPercent)}%</Text>
              </View>
              <Text style={[styles.scVal, { color: t.calNum }]}>
                {Math.round(summary.protein_g)}
                <Text style={[styles.scUnit, { color: t.text(0.35) }]}>g</Text>
              </Text>
              <Text style={[styles.scName, { color: t.text(0.35) }]}>Protein</Text>
              <View style={[styles.scBar, { backgroundColor: t.barTrack }]}>
                <View style={[styles.scFill, { width: `${Math.min(proteinPercent, 100)}%`, backgroundColor: LIME, opacity: 0.75 }]} />
              </View>
            </View>

            {/* Steps */}
            <View style={[styles.statCard, { backgroundColor: t.statCardBg, borderColor: t.statCardBorder }]}>
              <View style={styles.scHead}>
                <View style={[styles.scIcon, { backgroundColor: ORANGE + "1A" }]}>
                  <Ionicons name="footsteps" size={13} color={ORANGE} />
                </View>
                <Text style={[styles.scPct, { color: ORANGE }]}>{Math.round(stepsPercent)}%</Text>
              </View>
              <Text style={[styles.scVal, { color: t.calNum }]}>
                {displaySteps >= 1000 ? `${(displaySteps / 1000).toFixed(1)}` : `${displaySteps}`}
                <Text style={[styles.scUnit, { color: t.text(0.35) }]}>{displaySteps >= 1000 ? "k" : ""}</Text>
              </Text>
              <Text style={[styles.scName, { color: t.text(0.35) }]}>Steps</Text>
              <View style={[styles.scBar, { backgroundColor: t.barTrack }]}>
                <View style={[styles.scFill, { width: `${Math.min(stepsPercent, 100)}%`, backgroundColor: ORANGE, opacity: 0.75 }]} />
              </View>
            </View>
          </View>

          {/* Water */}
          <View style={[styles.waterCard, { backgroundColor: t.waterBg, borderColor: t.waterBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.wcTitle, { color: t.text(0.75) }]}>💧 Water intake</Text>
              <View style={styles.drops}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Text key={i} style={{ fontSize: 14, opacity: i < waterGlasses ? 1 : 0.2 }}>💧</Text>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.wcNum}>{waterGlasses}/8</Text>
              <Text style={[styles.wcOf, { color: t.text(0.3) }]}>glasses</Text>
            </View>
          </View>
        </View>

        {/* ── Food Log ─────────────────────────── */}
        <View style={styles.foodSection}>
          <View style={styles.fh}>
            <Text style={[styles.fl, { color: t.text(0.2) }]}>FOOD LOG</Text>
            <Pressable onPress={() => router.back()} style={styles.fa}>
              <Ionicons name="add" size={14} color="#000" />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={t.accent} size="small" />
            </View>
          ) : foodLogs.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Ionicons name="restaurant-outline" size={32} color={t.text(0.15)} />
              <Text style={{ color: t.text(0.25), fontSize: 13, marginTop: 8 }}>
                No food logged yet
              </Text>
            </View>
          ) : (
            foodLogs.map((item) => (
              <Pressable
                key={item.id}
                onLongPress={() => {
                  Alert.alert(
                    "Remove food log",
                    `Delete "${item.food_name}" (${item.calories} kcal)?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteFoodLog(item.id) },
                    ]
                  );
                }}
                style={[styles.foodRow, { borderBottomColor: t.foodBorder }]}
              >
                <Text style={styles.frEmoji}>{getMealEmoji(item.meal_type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.frName, { color: t.text(0.8) }]}>{item.food_name}</Text>
                  <Text style={[styles.frTime, { color: t.text(0.28) }]}>
                    {formatTime(item.logged_at || item.created_at)} · {capitalize(item.meal_type)}
                  </Text>
                </View>
                <Text style={[styles.frCal, { color: t.text(0.4) }]}>{item.calories} kcal</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: { fontSize: 16, fontStyle: "italic", fontWeight: "400" },
  topRight: { flexDirection: "row", gap: 8 },
  ico: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  calendarWrap: { borderBottomWidth: 1, paddingBottom: 8 },
  bento: { paddingHorizontal: 14, paddingTop: 14, gap: 9 },
  statRow: { flexDirection: "row", gap: 9 },
  calCard: {
    borderRadius: 20, padding: 18, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-end", overflow: "hidden", position: "relative",
  },
  calGlow: {
    position: "absolute", top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
  },
  eyebrow: { fontSize: 9, fontWeight: "500", letterSpacing: 1.6, marginBottom: 8 },
  calNum: { fontSize: 48, fontWeight: "300", lineHeight: 52, letterSpacing: -1.5 },
  calOf: { fontSize: 17 },
  calLabel: { fontSize: 11, marginTop: 4 },
  donutCenter: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
  donutPct: { fontSize: 11, fontWeight: "600", color: LIME },
  statCard: {
    flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 8,
  },
  scHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  scPct: { fontSize: 10, fontWeight: "500", letterSpacing: 0.5 },
  scVal: { fontSize: 28, fontWeight: "300", lineHeight: 28, letterSpacing: -0.8 },
  scUnit: { fontSize: 12, fontWeight: "400" },
  scName: { fontSize: 10 },
  scBar: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  scFill: { height: "100%", borderRadius: 2 },
  waterCard: {
    borderWidth: 1, borderRadius: 18,
    padding: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  wcTitle: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  drops: { flexDirection: "row", gap: 3, alignItems: "center" },
  wcNum: { fontSize: 28, fontWeight: "300", color: SKY, letterSpacing: -0.8 },
  wcOf: { fontSize: 10, marginTop: 1 },
  foodSection: { paddingHorizontal: 14, marginTop: 4 },
  fh: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4,
  },
  fl: { fontSize: 9, fontWeight: "500", letterSpacing: 1.6 },
  fa: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: LIME, alignItems: "center", justifyContent: "center",
  },
  foodRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingVertical: 8, borderBottomWidth: 1,
  },
  frEmoji: { fontSize: 18 },
  frName: { fontSize: 12, fontWeight: "500" },
  frTime: { fontSize: 9, marginTop: 1 },
  frCal: { fontSize: 11, fontWeight: "500" },
});
