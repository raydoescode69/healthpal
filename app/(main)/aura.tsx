import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES } from "../../lib/theme";

export default function AuraScreen() {
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBg }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Aura Score</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Ionicons name="sparkles" size={48} color={colors.accent} />
        <Text style={[styles.placeholder, { color: colors.text }]}>
          Aura Score
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholder: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
});
