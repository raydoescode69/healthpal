import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES } from "../../lib/theme";
import { GOALS, DIET_TYPES } from "../../lib/types";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() ?? "");
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? "");
  const [goal, setGoal] = useState(profile?.goal ?? "");
  const [dietType, setDietType] = useState(profile?.diet_type ?? "");
  const [saving, setSaving] = useState(false);

  const canSave =
    name.trim().length > 0 &&
    age.length > 0 &&
    weight.length > 0 &&
    height.length > 0 &&
    goal.length > 0 &&
    dietType.length > 0;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const updated = {
        id: user.id,
        name: name.trim(),
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
        goal,
        diet_type: dietType,
      };
      const { error } = await supabase.from("profiles").upsert(updated);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setProfile(updated);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

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
            Edit Goals
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <Text style={{ color: colors.subText, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            style={{
              backgroundColor: colors.cardBg,
              color: colors.textPrimary,
              fontSize: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: 20,
            }}
          />

          {/* Metrics row */}
          <Text style={{ color: colors.subText, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Body Metrics
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Age", value: age, onChange: setAge, suffix: "yrs" },
              { label: "Weight", value: weight, onChange: setWeight, suffix: "kg" },
              { label: "Height", value: height, onChange: setHeight, suffix: "cm" },
            ].map((field) => (
              <View key={field.label} style={{ flex: 1 }}>
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder={field.label}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: colors.cardBg,
                    color: colors.textPrimary,
                    fontSize: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    textAlign: "center",
                  }}
                />
                <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: "center", marginTop: 4 }}>
                  {field.suffix}
                </Text>
              </View>
            ))}
          </View>

          {/* Goal */}
          <Text style={{ color: colors.subText, fontSize: 12, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Goal
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            {GOALS.map((g) => {
              const selected = goal === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setGoal(g.id)}
                  style={{
                    flexBasis: "47%" as any,
                    flexGrow: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: selected ? colors.accent : colors.cardBg,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.cardBorder,
                  }}
                >
                  <Ionicons
                    name={g.icon as any}
                    size={20}
                    color={selected ? "#000" : colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <Text
                    style={{
                      color: selected ? "#000" : colors.textPrimary,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Diet Type */}
          <Text style={{ color: colors.subText, fontSize: 12, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Diet Preference
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
            {DIET_TYPES.map((d) => {
              const selected = dietType === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setDietType(d.id)}
                  style={{
                    flexBasis: "47%" as any,
                    flexGrow: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: selected ? colors.accent : colors.cardBg,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.cardBorder,
                  }}
                >
                  <Ionicons
                    name={d.icon as any}
                    size={20}
                    color={selected ? "#000" : colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <Text
                    style={{
                      color: selected ? "#000" : colors.textPrimary,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={({ pressed }) => ({
              backgroundColor: canSave ? (pressed ? colors.accentDark : colors.accent) : colors.cardBg,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: "center",
              opacity: saving ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: canSave ? "#000" : colors.textFaint,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
