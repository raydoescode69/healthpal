import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";
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

      const userId = data.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profile) {
          setProfile(profile);
          router.replace("/(main)/chat");
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
    <View style={styles.container}>
      {/* Video background */}
      <Video
        source={require("../../assets/splash-video.mp4")}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      {/* Dark overlay for readability */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <Text style={styles.title}>Nyra</Text>
          <Text style={styles.subtitle}>Your AI nutrition companion</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(800).delay(400)}
          style={styles.form}
        >
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.8}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  header: {
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
    textAlign: "center",
  },
  form: {
    width: "100%",
    marginTop: 48,
    gap: 16,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  button: {
    backgroundColor: "#A8FF3E",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "600",
  },
  switchBtn: {
    alignItems: "center",
    marginTop: 8,
  },
  switchText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
});
