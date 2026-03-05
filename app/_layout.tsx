import "../global.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { useColorScheme, Appearance } from "react-native";
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
  const syncWithSystem = useThemeStore((s) => s.syncWithSystem);
  const systemColorScheme = useColorScheme();

  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [authCheckDone, setAuthCheckDone] = useState(false);

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

  // Sync theme with system color scheme
  useEffect(() => {
    syncWithSystem(systemColorScheme === "light" ? "light" : "dark");
  }, [systemColorScheme]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      syncWithSystem(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);

  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Wait for the first onAuthStateChange event OR a 2s timeout before allowing navigation
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        // Handle invalid/expired tokens — force sign out
        if (event === "TOKEN_REFRESHED" && !sess) {
          console.warn("[Auth] Token refresh failed, signing out");
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setAuthCheckDone(true);
          return;
        }

        setSession(sess);
        setUser(sess?.user ?? null);
        setAuthCheckDone(true);

        if (sess?.user?.id) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", sess.user.id)
              .single();
            if (profile) setProfile(profile);
          } catch {}
        }
      }
    );

    // Also catch stale sessions on startup
    supabase.auth.getSession().then(({ error }) => {
      if (error?.message?.includes("Refresh Token")) {
        console.warn("[Auth] Stale refresh token, signing out");
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthCheckDone(true);
      }
    });

    // Fallback: if onAuthStateChange doesn't fire within 2s, proceed anyway
    const timeout = setTimeout(() => {
      setAuthCheckDone(true);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
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

  // Force-dismiss splash after 3s as a safety net
  useEffect(() => {
    const forceDismiss = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(forceDismiss);
  }, []);

  // Route protection: only navigate after auth state is resolved
  useEffect(() => {
    if (!fontsLoaded || !authCheckDone) return;

    const inAuth = segments[0] === "(auth)";

    if (!session && !inAuth) {
      router.replace("/(auth)");
    } else if (session && inAuth) {
      // Check if profile has required fields for nutrition calculations
      const profile = useAuthStore.getState().profile;
      const isProfileComplete = profile?.age && profile?.weight_kg && profile?.height_cm;
      if (isProfileComplete) {
        router.replace("/(main)/chat");
      } else {
        router.replace("/(auth)/onboarding");
      }
    }
  }, [session, fontsLoaded, authCheckDone, segments]);

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
