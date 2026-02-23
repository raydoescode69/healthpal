import "../global.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import AnimatedSplash from "../components/AnimatedSplash";
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from "@expo-google-fonts/sora";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useLiveActivity } from "../lib/useLiveActivity";
import { useAndroidNotification } from "../lib/useAndroidNotification";
import {
  setupNotificationChannels,
  configureForegroundHandler,
  setupNotificationResponseHandler,
  registerForPushNotifications,
  scheduleMealReminders,
} from "../lib/notificationService";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, setSession, setUser, setProfile } = useAuthStore();
  const mode = useThemeStore((s) => s.mode);

  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useLiveActivity();
  useAndroidNotification();

  const notificationResponseRef = useRef<ReturnType<typeof setupNotificationResponseHandler> | null>(null);

  // Initialize notification infrastructure on mount
  useEffect(() => {
    setupNotificationChannels();
    configureForegroundHandler();
    notificationResponseRef.current = setupNotificationResponseHandler();
    return () => {
      notificationResponseRef.current?.remove();
    };
  }, []);

  // Register push token + schedule meal reminders when user is authenticated
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotifications(session.user.id);
      scheduleMealReminders();
    }
  }, [session?.user?.id]);

  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user?.id) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();
            if (profile) setProfile(profile);
          } catch {}
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Hide native splash as soon as our animated splash mounts
  useEffect(() => {
    SplashScreen.hideAsync();
    const timer = setTimeout(() => setMinTimeElapsed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const isReady = fontsLoaded && minTimeElapsed;

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    const inAuth = segments[0] === "(auth)";

    if (!session && !inAuth) {
      router.replace("/(auth)");
    } else if (session && inAuth) {
      router.replace("/(main)/chat");
    }
  }, [session, fontsLoaded, segments]);

  if (!fontsLoaded) {
    return (
      <AnimatedSplash
        isReady={isReady}
        onAnimationComplete={handleSplashComplete}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {showSplash && (
        <AnimatedSplash
          isReady={isReady}
          onAnimationComplete={handleSplashComplete}
        />
      )}
      <Slot />
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
    </GestureHandlerRootView>
  );
}
