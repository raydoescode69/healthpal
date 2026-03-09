import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
} from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setProfile } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // No auto-transition — wait for user to tap "Get Started"

  const navigateAfterAuth = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profile && profile.age && profile.weight_kg && profile.height_cm) {
      setProfile(profile);
      router.replace("/(main)/chat");
    } else {
      router.replace("/(auth)/onboarding");
    }
  }, [router, setProfile]);

  const createSessionFromUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const parsed = new URL(url);

      const code = parsed.searchParams.get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return false;
        const userId = data.session?.user?.id;
        if (userId) { await navigateAfterAuth(userId); return true; }
        return false;
      }

      const hashStr = parsed.hash?.startsWith("#") ? parsed.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hashStr);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) return false;
        const userId = data.session?.user?.id;
        if (userId) { await navigateAfterAuth(userId); return true; }
        return false;
      }

      const errorDesc = parsed.searchParams.get("error_description") || hashParams.get("error_description");
      if (errorDesc) Alert.alert("Sign-in Error", errorDesc);

      return false;
    } catch { return false; }
  }, [navigateAfterAuth]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const result = await Promise.race([
        isSignUp
          ? supabase.auth.signUp({ email, password })
          : supabase.auth.signInWithPassword({ email, password }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 15000)),
      ]) as any;
      const { data, error } = result;

      if (error) { Alert.alert("Error", error.message); return; }

      const userId = data.session?.user?.id;
      if (userId) {
        await navigateAfterAuth(userId);
      } else if (isSignUp) {
        Alert.alert("Check your email", "A confirmation link has been sent.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectTo = "healthpal://google-auth";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error || !data.url) {
        Alert.alert("Error", error?.message ?? "Could not start Google sign-in.");
        setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const ok = await createSessionFromUrl(result.url);
        if (!ok) Alert.alert("Error", "Could not complete sign-in. Please try again.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Background video — always playing */}
        <Video
          source={require("../../assets/splash-video.mp4")}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
        <View style={styles.overlay} />

        {/* Phase 1: Welcome screen */}
        {!showAuth && (
          <Animated.View
            exiting={FadeOut.duration(500)}
            style={styles.welcomeContainer}
          >
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Animated.Text
                entering={FadeIn.duration(800)}
                style={styles.welcomeTitle}
              >
                Nyra
              </Animated.Text>
              <Animated.Text
                entering={FadeIn.duration(800).delay(400)}
                style={styles.welcomeSubtitle}
              >
                Your AI nutrition companion
              </Animated.Text>
              <Animated.Text
                entering={FadeIn.duration(600).delay(900)}
                style={styles.welcomeTagline}
              >
                Eat smarter. Live better.
              </Animated.Text>
            </View>

            {/* "Get Started" button at bottom */}
            <Animated.View
              entering={FadeInUp.duration(600).delay(1200)}
              style={{ paddingBottom: insets.bottom + 48, alignItems: "center" }}
            >
              <TouchableOpacity
                onPress={() => setShowAuth(true)}
                activeOpacity={0.8}
                style={styles.getStartedBtn}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {/* Phase 2: Auth form — smooth fade in */}
        {showAuth && (
          <Animated.View
            entering={FadeIn.duration(600).delay(300)}
            style={StyleSheet.absoluteFill}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <View style={styles.authContainer}>
                {/* Header */}
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={styles.authTitle}>Nyra</Text>
                  <Text style={styles.authSubtitle}>Your AI nutrition companion</Text>
                </View>

                {/* Form area */}
                <View style={[styles.formCard, { paddingBottom: insets.bottom + 20 }]}>
                  {/* Google sign-in */}
                  <TouchableOpacity
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                    activeOpacity={0.8}
                    style={styles.googleButton}
                  >
                    <GoogleLogo size={20} />
                    <Text style={styles.googleButtonText}>
                      {loading ? "Please wait..." : "Continue with Google"}
                    </Text>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Email / Password */}
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    secureTextEntry
                    style={styles.input}
                  />

                  <TouchableOpacity
                    onPress={handleEmailAuth}
                    disabled={loading}
                    activeOpacity={0.8}
                    style={styles.emailButton}
                  >
                    <Text style={styles.emailButtonText}>
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
                </View>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        )}
      </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },

  // ── Welcome phase ──
  welcomeContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  welcomeTitle: {
    fontSize: 56,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.7)",
    marginTop: 12,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  welcomeTagline: {
    fontSize: 15,
    color: "rgba(190,241,53,0.8)",
    marginTop: 20,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  getStartedBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 28,
  },
  getStartedText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // ── Auth phase ──
  authContainer: {
    flex: 1,
  },
  authTitle: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: -1,
    textAlign: "center",
  },
  authSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginTop: 10,
    textAlign: "center",
  },
  formCard: {
    paddingHorizontal: 28,
    paddingTop: 28,
    gap: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  googleButtonText: {
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    marginHorizontal: 14,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emailButton: {
    backgroundColor: "#A8FF3E",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 2,
  },
  emailButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "600",
  },
  switchBtn: {
    alignItems: "center",
    marginTop: 2,
  },
  switchText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
  },
});
