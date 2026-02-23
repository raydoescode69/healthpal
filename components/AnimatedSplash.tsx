import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useThemeStore } from "../store/useThemeStore";

const COLORS = {
  dark: { bg: "#000", text: "#fff", subtext: "#666" },
  light: { bg: "#F5F5F5", text: "#111", subtext: "#999" },
};

interface AnimatedSplashProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({
  isReady,
  onAnimationComplete,
}: AnimatedSplashProps) {
  const mode = useThemeStore((s) => s.mode);
  const colors = COLORS[mode];

  const nameOpacity = useSharedValue(0);
  const nameTranslateY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(12);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    nameOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    nameTranslateY.value = withDelay(
      100,
      withSpring(0, { damping: 14, stiffness: 90 })
    );
    taglineOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    taglineTranslateY.value = withDelay(
      350,
      withSpring(0, { damping: 14, stiffness: 90 })
    );
  }, []);

  useEffect(() => {
    if (!isReady) return;
    screenOpacity.value = withDelay(
      400,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onAnimationComplete)();
      })
    );
  }, [isReady]);

  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const nameAnimStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameTranslateY.value }],
  }));

  const taglineAnimStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.bg }, screenAnimStyle]}
    >
      <View style={styles.content}>
        <Animated.Text
          style={[styles.appName, { color: colors.text }, nameAnimStyle]}
        >
          Nyra
        </Animated.Text>
        <Animated.Text
          style={[styles.tagline, { color: colors.subtext }, taglineAnimStyle]}
        >
          Your AI nutrition companion
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  appName: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "400",
    marginTop: 8,
    letterSpacing: 0.3,
  },
});
