import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { GOALS, DIET_TYPES, type OnboardingData } from "../../lib/types";

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    age: "",
    weight: "",
    height: "",
    goal: "",
    diet_type: "",
  });

  const canNext = () => {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return data.age && data.weight && data.height;
      case 3:
        return data.goal.length > 0;
      case 4:
        return data.diet_type.length > 0;
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
    try {
      const profileData = {
        id: user!.id,
        name: data.name.trim(),
        age: parseInt(data.age, 10),
        weight: parseFloat(data.weight),
        height: parseFloat(data.height),
        goal: data.goal,
        diet_type: data.diet_type,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(profileData);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setProfile(profileData);
      router.replace("/(tabs)/chat");
    } catch (err: any) {
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
            className="w-full"
          >
            <Text className="text-2xl text-white font-sora-bold mb-2">
              What's your name?
            </Text>
            <Text className="text-brand-muted font-dm mb-8">
              Let's personalize your experience
            </Text>
            <TextInput
              value={data.name}
              onChangeText={(v) => setData({ ...data, name: v })}
              placeholder="Enter your name"
              placeholderTextColor="#666"
              className="bg-[#1A1A1A] text-white font-dm text-lg px-5 py-4 rounded-2xl"
            />
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View
            key="step2"
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            className="w-full"
          >
            <Text className="text-2xl text-white font-sora-bold mb-2">
              Your basics
            </Text>
            <Text className="text-brand-muted font-dm mb-8">
              Help us tailor recommendations
            </Text>
            {[
              { label: "Age", key: "age" as const, suffix: "years" },
              { label: "Weight", key: "weight" as const, suffix: "kg" },
              { label: "Height", key: "height" as const, suffix: "cm" },
            ].map((field) => (
              <View key={field.key} className="mb-4">
                <Text className="text-brand-muted font-dm mb-2 text-sm">
                  {field.label} ({field.suffix})
                </Text>
                <TextInput
                  value={data[field.key]}
                  onChangeText={(v) => setData({ ...data, [field.key]: v })}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  className="bg-[#1A1A1A] text-white font-dm text-lg px-5 py-4 rounded-2xl"
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
            className="w-full"
          >
            <Text className="text-2xl text-white font-sora-bold mb-2">
              What's your goal?
            </Text>
            <Text className="text-brand-muted font-dm mb-8">
              Pick one that fits you best
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setData({ ...data, goal: g.id })}
                  className={`flex-1 min-w-[45%] p-5 rounded-2xl items-center ${
                    data.goal === g.id
                      ? "bg-brand-green"
                      : "bg-[#1A1A1A]"
                  }`}
                >
                  <Text className="text-3xl mb-2">{g.icon}</Text>
                  <Text
                    className={`font-dm-medium text-sm ${
                      data.goal === g.id ? "text-brand-dark" : "text-white"
                    }`}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      case 4:
        return (
          <Animated.View
            key="step4"
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            className="w-full"
          >
            <Text className="text-2xl text-white font-sora-bold mb-2">
              Dietary preference?
            </Text>
            <Text className="text-brand-muted font-dm mb-8">
              We'll customize meal suggestions
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {DIET_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setData({ ...data, diet_type: d.id })}
                  className={`flex-1 min-w-[45%] p-5 rounded-2xl items-center ${
                    data.diet_type === d.id
                      ? "bg-brand-green"
                      : "bg-[#1A1A1A]"
                  }`}
                >
                  <Text className="text-3xl mb-2">{d.icon}</Text>
                  <Text
                    className={`font-dm-medium text-sm ${
                      data.diet_type === d.id ? "text-brand-dark" : "text-white"
                    }`}
                  >
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
    <ScrollView
      className="flex-1 bg-brand-dark"
      contentContainerClassName="flex-grow px-6 pt-16 pb-10 justify-between"
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress dots */}
      <View className="flex-row justify-center gap-2 mb-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${
              i + 1 <= step ? "bg-brand-green w-6" : "bg-[#333] w-2"
            }`}
          />
        ))}
      </View>

      {renderStep()}

      {/* Navigation */}
      <View className="mt-10">
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canNext()}
          className={`py-4 rounded-2xl items-center ${
            canNext() ? "bg-brand-green" : "bg-[#333]"
          }`}
        >
          <Text
            className={`text-lg font-sora-semibold ${
              canNext() ? "text-brand-dark" : "text-brand-muted"
            }`}
          >
            {step === TOTAL_STEPS ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>

        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            className="mt-4 items-center"
          >
            <Text className="text-brand-muted font-dm text-base">Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
