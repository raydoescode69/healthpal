import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, AppState, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useBetsStore } from "../../store/useBetsStore";

function useCountdown(expiresAt: string) {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0, isExpired: false });
  useEffect(() => {
    const tick = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) { setTime({ hours: 0, minutes: 0, seconds: 0, isExpired: true }); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTime({ hours: h, minutes: m, seconds: s, isExpired: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return time;
}

export default function BetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.session?.user);
  const { activeChallenge, participants, isLoading, loadChallenge, subscribeToActive, unsubscribeFromActive } = useBetsStore();
  const appState = useRef(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      loadChallenge(id);
      subscribeToActive(id);
      return () => unsubscribeFromActive();
    }, [id])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/background/) && next === "active" && id) {
        subscribeToActive(id);
      } else if (next.match(/background/)) {
        unsubscribeFromActive();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [id]);

  const countdown = useCountdown(activeChallenge?.expires_at || new Date().toISOString());
  const isActive = activeChallenge?.status === "active";
  const userId = user?.id;
  const currentUser = participants.find((p) => p.user_id === userId);
  const progress = currentUser ? Math.min(currentUser.current_value / (activeChallenge?.target || 1), 1) : 0;
  const fmt = (n: number) => n.toString().padStart(2, "0");
  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

  if (isLoading || !activeChallenge) {
    return <SafeAreaView style={s.safe}><ActivityIndicator color="#ff9a3c" style={{ marginTop: 100 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></Pressable>
          <Text style={s.headerTitle}>Beast Bets 🏆</Text>
        </View>

        <View style={s.betCard}>
          <View style={s.liveBadge}><Text style={s.liveText}>{isActive ? "LIVE" : "FINISHED"}</Text></View>
          <Text style={s.betLabel}>{isActive ? "⚡ ACTIVE BET" : "COMPLETED"}</Text>
          <Text style={s.betTitle}>{activeChallenge.title}</Text>
          {isActive && currentUser && (
            <>
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Your progress</Text>
                <Text style={s.progressValue}>{currentUser.current_value.toLocaleString()} / {activeChallenge.target.toLocaleString()}</Text>
              </View>
              <View style={s.progressBg}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
            </>
          )}
        </View>

        {isActive && (
          <View style={s.timerRow}>
            <Text style={[s.timerLabel, { fontFamily: mono }]}>
              {countdown.isExpired ? "EXPIRED" : "EXPIRES IN"}
            </Text>
            <Text style={[s.timerTime, { fontFamily: mono, color: countdown.isExpired ? "#ff4d4d" : "#ff9a3c" }]}>
              {countdown.isExpired ? "00:00:00" : `${fmt(countdown.hours)}:${fmt(countdown.minutes)}:${fmt(countdown.seconds)}`}
            </Text>
          </View>
        )}

        <Text style={s.leaderboardTitle}>Leaderboard</Text>
        {participants.map((p, i) => {
          const isMe = p.user_id === userId;
          const isFirst = i === 0;
          const miniProgress = Math.min(p.current_value / (activeChallenge.target || 1), 1);
          return (
            <View key={p.id} style={[s.playerRow, isMe && s.playerRowMe]}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Text style={[s.rank, isFirst && s.rankGold]}>{isFirst ? "🏆" : i + 1}</Text>
                <View style={s.avatarCircle}><Text style={{ fontSize: 14 }}>{p.avatar_emoji || "🐉"}</Text></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.playerName}>{p.display_name || `Player ${i + 1}`}</Text>
                    {isMe && <View style={s.youBadge}><Text style={s.youText}>YOU</Text></View>}
                  </View>
                  <View style={s.miniBg}><View style={[s.miniFill, { width: `${miniProgress * 100}%` }]} /></View>
                </View>
              </View>
              <Text style={[s.playerScore, isMe && { color: "#ff9a3c" }]}>{p.current_value.toLocaleString()}</Text>
            </View>
          );
        })}

        {!isActive && participants.length > 0 && (
          <View style={s.winnerCard}>
            <Text style={{ fontSize: 32 }}>🏆</Text>
            <Text style={s.winnerText}>Winner: {participants[0]?.display_name || "Player 1"}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  betCard: { backgroundColor: "rgba(255,154,60,0.05)", borderWidth: 1, borderColor: "#ff9a3c", borderRadius: 20, padding: 20, position: "relative", marginBottom: 16 },
  liveBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(255,154,60,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,154,60,0.3)" },
  liveText: { color: "#ff9a3c", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  betLabel: { color: "#ff9a3c", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  betTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 16, lineHeight: 28 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: "#888", fontSize: 12 },
  progressValue: { color: "#ff9a3c", fontSize: 14, fontWeight: "700" },
  progressBg: { height: 8, backgroundColor: "#1A1A1A", borderRadius: 4 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "#ff9a3c" },
  timerRow: { backgroundColor: "#111", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timerLabel: { color: "#666", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" },
  timerTime: { fontSize: 18, fontWeight: "700", marginLeft: 12, letterSpacing: 2 },
  leaderboardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  playerRow: { backgroundColor: "#141414", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  playerRowMe: { backgroundColor: "rgba(255,154,60,0.08)", borderWidth: 1, borderColor: "rgba(255,154,60,0.3)" },
  rank: { color: "#888", fontSize: 14, fontWeight: "700", width: 24 },
  rankGold: { color: "#FFD700" },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  playerName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  youBadge: { backgroundColor: "rgba(255,154,60,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  youText: { color: "#ff9a3c", fontSize: 9, fontWeight: "700" },
  miniBg: { height: 4, backgroundColor: "#1A1A1A", borderRadius: 2, marginTop: 6 },
  miniFill: { height: 4, borderRadius: 2, backgroundColor: "#A8FF3E" },
  playerScore: { color: "#fff", fontSize: 14, fontWeight: "700", marginLeft: 8 },
  winnerCard: { backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 16, padding: 20, alignItems: "center", marginTop: 16, gap: 8 },
  winnerText: { color: "#FFD700", fontSize: 16, fontWeight: "700" },
});
