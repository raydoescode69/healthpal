import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";

export default function LoginScreen() {
  const router = useRouter();
  const { setProfile } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      if (isSignUp) {
        Alert.alert("Check your email", "A confirmation link has been sent.");
        return;
      }

      // Check if profile exists
      const userId = data.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profile) {
          setProfile(profile);
          router.replace("/(tabs)/chat");
        } else {
          router.replace("/(auth)/onboarding");
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-brand-dark items-center justify-center px-8">
      <Animated.View entering={FadeIn.duration(800)} className="items-center">
        <Text className="text-5xl text-white font-sora-bold tracking-tight">
          HealthPal
        </Text>
        <Text className="text-base text-brand-muted font-dm mt-3 text-center">
          Your AI-powered health companion
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(800).delay(400)}
        className="w-full mt-12 gap-4"
      >
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          className="bg-[#1A1A1A] text-white font-dm text-base px-5 py-4 rounded-2xl"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#666"
          secureTextEntry
          className="bg-[#1A1A1A] text-white font-dm text-base px-5 py-4 rounded-2xl"
        />

        <TouchableOpacity
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.8}
          className="bg-brand-green py-4 rounded-2xl items-center mt-2"
        >
          <Text className="text-brand-dark text-lg font-sora-semibold">
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsSignUp(!isSignUp)}
          className="items-center mt-2"
        >
          <Text className="text-brand-muted font-dm text-sm">
            {isSignUp
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
