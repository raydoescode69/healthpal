import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import {
  GOALS,
  DIET_TYPES,
  type OnboardingData,
} from "../../lib/types";

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    age: "",
    weight_kg: "",
    height_cm: "",
    goal: "",
    diet_type: "",
  });

  const canNext = () => {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return data.age && data.weight_kg && data.height_cm;
      case 3:
        return data.goal.length > 0 && data.diet_type.length > 0;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }

    // Final step — save profile
    setSaving(true);
    console.log("[Onboarding] Get Started pressed, saving=true");
    console.log("[Onboarding] user:", user?.id);
    console.log("[Onboarding] data:", JSON.stringify(data));
    try {
      const profileData = {
        id: user!.id,
        name: data.name.trim(),
        age: parseInt(data.age, 10),
        weight_kg: parseFloat(data.weight_kg),
        height_cm: parseFloat(data.height_cm),
        goal: data.goal,
        diet_type: data.diet_type,
      };

      console.log("[Onboarding] profileData:", JSON.stringify(profileData));
      console.log("[Onboarding] Calling supabase upsert...");

      // Race the upsert against a timeout to avoid hanging forever
      const upsertPromise = supabase.from("profiles").upsert(profileData).select().single();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase upsert timed out after 8s")), 8000)
      );

      let upsertError: any = null;
      try {
        const result = await Promise.race([upsertPromise, timeoutPromise]) as any;
        upsertError = result?.error;
        console.log("[Onboarding] Upsert done. error:", upsertError?.message ?? "none");
      } catch (e: any) {
        console.log("[Onboarding] Upsert race error:", e?.message);
        // On timeout, still try to navigate — the data might have saved
      }

      if (upsertError) {
        setSaving(false);
        console.log("[Onboarding] Upsert FAILED:", upsertError.message);
        Alert.alert("Error", upsertError.message);
        return;
      }

      // Update store and navigate
      console.log("[Onboarding] Calling setProfile...");
      setProfile(profileData);
      console.log("[Onboarding] setProfile done, navigating to chat...");
      router.replace("/(main)/chat");
    } catch (err: any) {
      console.log("[Onboarding] CATCH error:", err?.message);
      setSaving(false);
      Alert.alert("Error", err.message ?? "Failed to save profile.");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Animated.View
            key="step1"
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={{ width: "100%" }}
          >
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>Let's personalize your experience</Text>
            <TextInput
              value={data.name}
              onChangeText={(v) => setData({ ...data, name: v })}
              placeholder="Enter your name"
              placeholderTextColor="#666"
              style={styles.input}
            />
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View
            key="step2"
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={{ width: "100%" }}
          >
            <Text style={styles.title}>Your basics</Text>
            <Text style={styles.subtitle}>Needed for calorie & nutrition targets</Text>
            {[
              { label: "Age", key: "age" as const, suffix: "years", placeholder: "e.g. 25" },
              { label: "Weight", key: "weight_kg" as const, suffix: "kg", placeholder: "e.g. 70" },
              { label: "Height", key: "height_cm" as const, suffix: "cm", placeholder: "e.g. 170" },
            ].map((field) => (
              <View key={field.key} style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>
                  {field.label} ({field.suffix})
                </Text>
                <TextInput
                  value={data[field.key]}
                  onChangeText={(v) => setData({ ...data, [field.key]: v })}
                  placeholder={field.placeholder}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            ))}
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View
            key="step3"
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={{ width: "100%" }}
          >
            <Text style={styles.title}>Your preferences</Text>
            <Text style={styles.subtitle}>We'll tailor meals & goals for you</Text>

            <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Goal</Text>
            <View style={styles.optionRow}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setData({ ...data, goal: g.id })}
                  style={[styles.optionCard, data.goal === g.id && styles.optionCardSelected]}
                >
                  <Ionicons
                    name={g.icon as any}
                    size={28}
                    color={data.goal === g.id ? "#0D0D0D" : "#fff"}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={[styles.optionLabel, data.goal === g.id && styles.optionLabelSelected]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 24, marginBottom: 8 }]}>Diet</Text>
            <View style={styles.optionRow}>
              {DIET_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setData({ ...data, diet_type: d.id })}
                  style={[styles.optionCard, data.diet_type === d.id && styles.optionCardSelected]}
                >
                  <Ionicons
                    name={d.icon as any}
                    size={28}
                    color={data.diet_type === d.id ? "#0D0D0D" : "#fff"}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={[styles.optionLabel, data.diet_type === d.id && styles.optionLabelSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#0D0D0D" }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 64,
          paddingBottom: 40,
          justifyContent: "space-between",
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 40 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: i + 1 <= step ? "#A8FF3E" : "#333",
                width: i + 1 <= step ? 20 : 6,
              }}
            />
          ))}
        </View>

        {renderStep()}

        {/* Navigation */}
        <View style={{ marginTop: 32 }}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canNext() || saving}
            style={{
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: canNext() && !saving ? "#A8FF3E" : "#333",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {saving && <ActivityIndicator size="small" color="#0D0D0D" />}
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: canNext() && !saving ? "#0D0D0D" : "#666",
              }}
            >
              {saving ? "Setting up..." : step === TOTAL_STEPS ? "Get Started" : "Next"}
            </Text>
          </TouchableOpacity>

          {step > 1 && (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={{ marginTop: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#888", fontSize: 15 }}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  title: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    marginBottom: 28,
  },
  fieldLabel: {
    color: "#888",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1A1A1A",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  optionRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
  },
  optionCard: {
    flexBasis: "47%" as any,
    flexGrow: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: "center" as const,
    backgroundColor: "#1A1A1A",
  },
  optionCardSelected: {
    backgroundColor: "#A8FF3E",
  },
  optionLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500" as const,
  },
  optionLabelSelected: {
    color: "#0D0D0D",
  },
};
