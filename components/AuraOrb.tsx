import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AuraOrbProps {
  score: number;
  color: string;
  size?: number;
}

export default function AuraOrb({ score, color, size = 240 }: AuraOrbProps) {
  const cx = size / 2;
  const cy = size / 2;

  // Animated scale pulses for glow layers
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);

  React.useEffect(() => {
    pulse1.value = withRepeat(
      withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    // Offset timing for second layer
    pulse2.value = withRepeat(
      withTiming(1.06, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse1, pulse2]);

  // Outermost glow ring - animated
  const outerR = size / 2;
  const animatedOuterProps = useAnimatedProps(() => ({
    r: outerR * pulse1.value,
  }));

  // Middle glow ring - animated with offset
  const middleR = size / 2 * 0.75;
  const animatedMiddleProps = useAnimatedProps(() => ({
    r: middleR * pulse2.value,
  }));

  // Inner static rings
  const innerR = size / 2 * 0.5;
  const coreR = size / 2 * 0.35;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outermost glow - animated pulse */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          fill={color}
          opacity={0.08}
          animatedProps={animatedOuterProps}
        />
        {/* Middle glow - animated pulse (offset) */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          fill={color}
          opacity={0.15}
          animatedProps={animatedMiddleProps}
        />
        {/* Inner glow - static */}
        <Circle cx={cx} cy={cy} r={innerR} fill={color} opacity={0.25} />
        {/* Core - static */}
        <Circle cx={cx} cy={cy} r={coreR} fill={color} opacity={0.4} />
      </Svg>

      {/* Score overlay */}
      <View style={styles.scoreOverlay}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={styles.scoreSuffix}>/ 100</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: "#fff",
  },
  scoreSuffix: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginLeft: 4,
  },
});
