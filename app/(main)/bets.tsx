import React, { useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useBetsStore } from "../../store/useBetsStore";
import { resolveExpiredChallenges } from "../../lib/betsService";
import type { Challenge } from "../../lib/types";

export default function BetsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.session?.user);
  const { challenges, isLoading, loadChallenges } = useBetsStore();

  useEffect(() => {
    if (!user?.id) return;
    resolveExpiredChallenges(user.id).then(() => loadChallenges(user.id));
  }, [user?.id]);

  const active = challenges.filter((c: Challenge) => c.status === "active");
  const completed = challenges.filter((c: Challenge) => c.status === "completed");

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={s.headerTitle}>Beast Bets 🏆</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#ff9a3c" style={{ marginTop: 60 }} />
        ) : challenges.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={s.emptyTitle}>No bets yet</Text>
            <Text style={s.emptySub}>Challenge your friends to a 24-hour health showdown</Text>
          </View>
        ) : (
          <>
            {active.map((c: Challenge) => (
              <Pressable key={c.id} onPress={() => router.push(`/(main)/bet-detail?id=${c.id}`)} style={s.activeCard}>
                <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View>
                <Text style={s.activeLbl}>⚡ ACTIVE BET</Text>
                <Text style={s.challengeTitle}>{c.title}</Text>
                <Text style={s.metricSub}>{c.metric} · target {c.target.toLocaleString()}</Text>
              </Pressable>
            ))}
            {completed.length > 0 && <Text style={s.sectionLbl}>Completed</Text>}
            {completed.map((c: Challenge) => (
              <Pressable key={c.id} onPress={() => router.push(`/(main)/bet-detail?id=${c.id}`)} style={s.completedCard}>
                <Text style={s.completedLbl}>COMPLETED</Text>
                <Text style={s.completedTitle}>{c.title}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <View style={s.bottomBtn}>
        <Pressable onPress={() => router.push("/(main)/create-bet")} style={s.newBetBtn}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <Text style={s.newBetText}>New Bet — Challenge a Friend</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  emptySub: { color: "#666", fontSize: 14, textAlign: "center", maxWidth: 240 },
  activeCard: { backgroundColor: "rgba(255,154,60,0.05)", borderWidth: 1, borderColor: "#ff9a3c", borderRadius: 20, padding: 20, marginBottom: 12, position: "relative" },
  liveBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(255,154,60,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,154,60,0.3)" },
  liveText: { color: "#ff9a3c", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  activeLbl: { color: "#ff9a3c", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  challengeTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  metricSub: { color: "#888", fontSize: 13 },
  sectionLbl: { color: "#666", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 12 },
  completedCard: { backgroundColor: "#111", borderWidth: 1, borderColor: "#222", borderRadius: 16, padding: 16, marginBottom: 8 },
  completedLbl: { color: "#666", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  completedTitle: { color: "#888", fontSize: 15, fontWeight: "600" },
  bottomBtn: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: "#0D0D0D" },
  newBetBtn: { backgroundColor: "rgba(255,154,60,0.15)", borderWidth: 1, borderColor: "rgba(255,154,60,0.3)", borderRadius: 14, paddingVertical: 16 },
  newBetText: { color: "#ff9a3c", fontSize: 15, fontWeight: "700" },
});
