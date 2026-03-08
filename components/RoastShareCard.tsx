import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getStatColor } from "../lib/roastEngine";

interface RoastShareCardProps {
  roastText: string;
  verdictTitle: string;
  verdictEmoji: string;
  calories: number;
  steps: number;
  sleepHours: number;
}

export const RoastShareCard = React.forwardRef<View, RoastShareCardProps>(
  ({ roastText, verdictTitle, verdictEmoji, calories, steps, sleepHours }, ref) => {
    return (
      <View ref={ref} collapsable={false} style={s.card}>
        <Text style={s.title}>🔥 NYRA'S DAILY ROAST</Text>
        <View style={s.avatar}>
          <Text style={{ fontSize: 24 }}>🤖</Text>
        </View>
        <Text style={s.roastText}>{roastText}</Text>
        <View style={s.pillsRow}>
          <View style={s.pill}>
            <Text style={s.pillLabel}>CALORIES</Text>
            <Text style={[s.pillVal, { color: getStatColor(calories, "calories") }]}>{calories}</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillLabel}>STEPS</Text>
            <Text style={[s.pillVal, { color: getStatColor(steps, "steps") }]}>{steps}</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillLabel}>SLEEP</Text>
            <Text style={[s.pillVal, { color: getStatColor(sleepHours, "sleep") }]}>{sleepHours}h</Text>
          </View>
        </View>
        <View style={s.verdictRow}>
          <Text style={{ fontSize: 20 }}>{verdictEmoji}</Text>
          <Text style={s.verdictText}>{verdictTitle}</Text>
        </View>
        <Text style={s.watermark}>nyra.app</Text>
      </View>
    );
  }
);

const s = StyleSheet.create({
  card: { width: 360, backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "rgba(255,77,77,0.3)", borderRadius: 24, padding: 24, alignItems: "center" },
  title: { color: "#ff4d4d", fontSize: 14, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,77,77,0.15)", borderWidth: 2, borderColor: "#ff4d4d", alignItems: "center", justifyContent: "center", marginVertical: 12 },
  roastText: { color: "#fff", fontSize: 15, lineHeight: 24, textAlign: "center", marginBottom: 16 },
  pillsRow: { flexDirection: "row", gap: 8, width: "100%" },
  pill: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pillLabel: { color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "600", letterSpacing: 1 },
  pillVal: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  verdictText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  watermark: { color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 16 },
});
