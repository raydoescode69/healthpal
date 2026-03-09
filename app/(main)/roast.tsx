import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Animated, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import { shareAsync } from "expo-sharing";
import { useAuthStore } from "../../store/useAuthStore";
import { useRoastStore } from "../../store/useRoastStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { generateRoast, getStatColor } from "../../lib/roastEngine";
import { RoastShareCard } from "../../components/RoastShareCard";

export default function RoastScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.session?.user);
  const { roast, isLoading: storeLoading, loadTodayRoast, saveRoast } = useRoastStore();
  const { getDailySummary, steps, waterGlasses } = useTrackingStore();
  const [generating, setGenerating] = useState(false);
  const shareCardRef = useRef<View>(null);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const sleepHours = 7;
  const summary = getDailySummary();
  const calories = summary.calories || 0;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadTodayRoast(user.id);
  }, [user?.id]);

  const hasAttemptedGeneration = useRef(false);

  useEffect(() => {
    if (!user?.id || roast || storeLoading || generating || hasAttemptedGeneration.current) return;
    hasAttemptedGeneration.current = true;
    const go = async () => {
      setGenerating(true);
      try {
        const result = await generateRoast({
          calories, protein_g: summary.protein_g || 0, carbs_g: summary.carbs_g || 0,
          fat_g: summary.fat_g || 0, steps, waterGlasses, sleepHours,
        });
        const today = new Date().toISOString().slice(0, 10);
        await saveRoast(user.id, { roast_text: result.roast_text, verdict_title: result.verdict_title, verdict_emoji: result.verdict_emoji, calories, steps, sleep_hours: sleepHours, scored_at: today });
      } catch (e) {
        console.warn("[Roast] Generation/save failed:", e);
      }
      setGenerating(false);
    };
    go();
  }, [user?.id, roast, storeLoading]);

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
      await shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your roast 💀" });
    } catch (e) { console.error("Share failed:", e); }
  }, []);

  const loading = storeLoading || generating;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>

        <Text style={s.title}>🔥 NYRA'S DAILY ROAST</Text>
        <View style={s.avatar}>
          <Text style={{ fontSize: 28 }}>🤖</Text>
        </View>

        {loading ? (
          <View>
            <Animated.View style={[s.bubble, { opacity: pulseAnim }]}>
              <Text style={s.loadingText}>Nyra is judging your choices...</Text>
            </Animated.View>
            <ActivityIndicator color="#ff4d4d" style={{ marginTop: 20 }} />
          </View>
        ) : roast ? (
          <>
            <View style={s.bubble}>
              <Text style={s.roastText}>{roast.roast_text}</Text>
            </View>

            <View style={s.pillsRow}>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Calories</Text>
                <Text style={[s.pillVal, { color: getStatColor(roast.calories, "calories") }]}>{roast.calories}</Text>
              </View>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Steps</Text>
                <Text style={[s.pillVal, { color: getStatColor(roast.steps, "steps") }]}>{roast.steps}</Text>
              </View>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Sleep</Text>
                <Text style={[s.pillVal, { color: getStatColor(roast.sleep_hours, "sleep") }]}>{roast.sleep_hours}h</Text>
              </View>
            </View>

            <View style={s.verdict}>
              <View style={s.verdictIcon}>
                <Text style={{ fontSize: 28 }}>{roast.verdict_emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.verdictTitle}>{roast.verdict_title}</Text>
                <Text style={s.verdictSub}>Today's Verdict</Text>
              </View>
            </View>

            <View style={s.buttonsRow}>
              <Pressable onPress={handleShare} style={[s.btn, s.shareBtn]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={s.shareBtnText}>Share the L 💀</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => router.push("/(main)/chat")} style={[s.btn, s.redeemBtn]}>
                <Text style={s.redeemBtnText}>Redemption?</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {roast && (
        <View style={{ position: "absolute", left: -9999, top: 0 }}>
          <RoastShareCard ref={shareCardRef} roastText={roast.roast_text} verdictTitle={roast.verdict_title} verdictEmoji={roast.verdict_emoji} calories={roast.calories} steps={roast.steps} sleepHours={roast.sleep_hours} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 60 },
  back: { marginBottom: 16 },
  title: { color: "#ff4d4d", fontSize: 18, fontWeight: "800", letterSpacing: 2, textAlign: "center", textTransform: "uppercase" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,77,77,0.15)", borderWidth: 2, borderColor: "#ff4d4d", alignSelf: "center", alignItems: "center", justifyContent: "center", marginVertical: 16 },
  bubble: { backgroundColor: "rgba(255,77,77,0.08)", borderWidth: 1, borderColor: "rgba(255,77,77,0.2)", borderRadius: 18, padding: 20, marginBottom: 20 },
  roastText: { color: "#fff", fontSize: 16, lineHeight: 26 },
  loadingText: { color: "rgba(255,255,255,0.4)", fontSize: 15, textAlign: "center" },
  pillsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  pill: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" },
  pillLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  pillVal: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  verdict: { backgroundColor: "rgba(255,77,77,0.08)", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 },
  verdictIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,77,77,0.15)", alignItems: "center", justifyContent: "center" },
  verdictTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  verdictSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  buttonsRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 16 },
  shareBtn: { backgroundColor: "#ff4d4d" },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  redeemBtn: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  redeemBtnText: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 15, textAlign: "center" },
});
