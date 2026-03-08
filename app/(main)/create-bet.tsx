import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useBetsStore } from "../../store/useBetsStore";
import { shareInvite } from "../../lib/betsService";
import type { Challenge } from "../../lib/types";

const METRICS: { key: Challenge["metric"]; label: string; icon: string; presets: number[] }[] = [
  { key: "steps", label: "Steps", icon: "footsteps-outline", presets: [5000, 8000, 10000, 12000] },
  { key: "calories", label: "Calories", icon: "flame-outline", presets: [300, 500, 800, 1000] },
  { key: "workout_minutes", label: "Workout Mins", icon: "timer-outline", presets: [15, 30, 45, 60] },
];

export default function CreateBetScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.session?.user);
  const { createChallenge } = useBetsStore();
  const [metric, setMetric] = useState<Challenge["metric"]>("steps");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = METRICS.find((m) => m.key === metric)!;
  const autoTitle = `First to ${target || "..."} ${selected.label.toLowerCase()} wins`;

  const handleCreate = async () => {
    if (!user?.id || !target) return;
    setCreating(true);
    try {
      const ch = await createChallenge(user.id, {
        title: title || autoTitle,
        metric,
        target: Number(target),
      });
      if (ch) await shareInvite(ch.id, ch.title);
      router.replace("/(main)/bets");
    } catch {}
    setCreating(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={s.headerTitle}>Create a Beast Bet</Text>
        </View>

        <Text style={s.sectionLabel}>Choose Your Metric</Text>
        <View style={s.metricsRow}>
          {METRICS.map((m) => (
            <Pressable key={m.key} onPress={() => setMetric(m.key)} style={[s.metricCard, metric === m.key && s.metricActive]}>
              <View style={{ alignItems: "center" }}>
                <Ionicons name={m.icon as any} size={28} color={metric === m.key ? "#ff9a3c" : "#fff"} />
                <Text style={[s.metricLabel, metric === m.key && { color: "#ff9a3c" }]}>{m.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>Set Target</Text>
        <TextInput style={s.targetInput} value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="0" placeholderTextColor="#444" />
        <Text style={s.targetUnit}>{selected.label.toLowerCase()}</Text>
        <View style={s.presetsRow}>
          {selected.presets.map((p) => (
            <Pressable key={p} onPress={() => setTarget(String(p))} style={s.presetPill}>
              <Text style={s.presetText}>{p.toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>Challenge Title</Text>
        <TextInput style={s.titleInput} value={title || autoTitle} onChangeText={setTitle} placeholderTextColor="#444" />

        <Pressable onPress={handleCreate} style={[s.createBtn, (!target || creating) && { opacity: 0.5 }]} disabled={!target || creating}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {creating ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ fontSize: 16 }}>⚡</Text>}
            <Text style={s.createBtnText}>Create & Share Invite</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  sectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 24 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricCard: { flex: 1, backgroundColor: "#161616", borderWidth: 1, borderColor: "#222", borderRadius: 12, paddingVertical: 20, alignItems: "center" },
  metricActive: { borderColor: "#ff9a3c", backgroundColor: "rgba(255,154,60,0.1)" },
  metricLabel: { color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 8 },
  targetInput: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#222", borderRadius: 12, color: "#fff", fontSize: 32, fontWeight: "700", textAlign: "center", paddingVertical: 16 },
  targetUnit: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 8 },
  presetsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  presetPill: { flex: 1, backgroundColor: "#161616", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  presetText: { color: "#ff9a3c", fontSize: 14, fontWeight: "600" },
  titleInput: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#222", borderRadius: 12, color: "#fff", fontSize: 16, padding: 16 },
  createBtn: { backgroundColor: "#ff9a3c", borderRadius: 14, paddingVertical: 16, marginTop: 32 },
  createBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
});
