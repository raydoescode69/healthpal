import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ActivityRingsProps {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  steps: number;
  stepTarget: number;
  water: number;
  waterTarget: number;
  textColor: string;
  subTextColor: string;
  mode?: "dark" | "light";
}

// ── Large gauge ring (open at bottom) ──────────────────────
const BIG_SIZE = 200;
const BIG_STROKE = 14;
const BIG_RADIUS = (BIG_SIZE - BIG_STROKE) / 2;
const BIG_CENTER = BIG_SIZE / 2;
const BIG_CIRCUMFERENCE = 2 * Math.PI * BIG_RADIUS;
const ARC_DEGREES = 260;
const ARC_LENGTH = BIG_CIRCUMFERENCE * (ARC_DEGREES / 360);
const ARC_GAP = BIG_CIRCUMFERENCE - ARC_LENGTH;
// Rotate so the gap is centered at the bottom
// Default start = 3 o'clock. Rotate by (90 + (360-ARC_DEGREES)/2) = 90 + 50 = 140
const ARC_ROTATION = 90 + (360 - ARC_DEGREES) / 2;

function BigRing({
  current,
  target,
  color,
  emoji,
  textColor,
  subTextColor,
  trackOpacity,
}: {
  current: number;
  target: number;
  color: string;
  emoji: string;
  textColor: string;
  subTextColor: string;
  trackOpacity: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(target > 0 ? Math.min(current / target, 1) : 0, {
      damping: 20,
      stiffness: 80,
    });
  }, [current, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - progress.value),
  }));

  const shortTarget = target >= 1000 ? `${(target / 1000).toFixed(target % 1000 === 0 ? 0 : 1)}k` : `${target}`;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ position: "relative", width: BIG_SIZE, height: BIG_SIZE }}>
        <Svg width={BIG_SIZE} height={BIG_SIZE}>
          {/* Track arc */}
          <Circle
            cx={BIG_CENTER}
            cy={BIG_CENTER}
            r={BIG_RADIUS}
            stroke={color + trackOpacity}
            strokeWidth={BIG_STROKE}
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${ARC_GAP}`}
            strokeLinecap="round"
            rotation={ARC_ROTATION}
            origin={`${BIG_CENTER}, ${BIG_CENTER}`}
          />
          {/* Progress arc — gap must be >= circumference to prevent dash pattern repeat */}
          <AnimatedCircle
            cx={BIG_CENTER}
            cy={BIG_CENTER}
            r={BIG_RADIUS}
            stroke={color}
            strokeWidth={BIG_STROKE}
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${BIG_CIRCUMFERENCE}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation={ARC_ROTATION}
            origin={`${BIG_CENTER}, ${BIG_CENTER}`}
          />
        </Svg>
        {/* Center content */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</Text>
          <Text style={{ color: textColor, fontSize: 34, fontWeight: "800" }}>
            {current.toLocaleString()}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 13, marginTop: 4 }}>
            Calories out of {shortTarget}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Small full-circle ring ─────────────────────────────────
const SM_SIZE = 52;
const SM_STROKE = 5;
const SM_RADIUS = (SM_SIZE - SM_STROKE) / 2;
const SM_CENTER = SM_SIZE / 2;
const SM_CIRCUMFERENCE = 2 * Math.PI * SM_RADIUS;

function SmallRing({
  current,
  target,
  color,
  emoji,
  valueText,
  textColor,
  subTextColor,
  trackOpacity,
}: {
  current: number;
  target: number;
  color: string;
  emoji: string;
  valueText: string;
  textColor: string;
  subTextColor: string;
  trackOpacity: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(target > 0 ? Math.min(current / target, 1) : 0, {
      damping: 20,
      stiffness: 80,
    });
  }, [current, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: SM_CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={{ position: "relative", width: SM_SIZE, height: SM_SIZE }}>
        <Svg width={SM_SIZE} height={SM_SIZE}>
          <Circle
            cx={SM_CENTER}
            cy={SM_CENTER}
            r={SM_RADIUS}
            stroke={color + trackOpacity}
            strokeWidth={SM_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SM_CENTER}
            cy={SM_CENTER}
            r={SM_RADIUS}
            stroke={color}
            strokeWidth={SM_STROKE}
            fill="none"
            strokeDasharray={SM_CIRCUMFERENCE}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SM_CENTER}, ${SM_CENTER}`}
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
      </View>
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "600", marginTop: 6 }}>
        {valueText}
      </Text>
    </View>
  );
}

export default function ActivityRings({
  calories,
  calorieTarget,
  protein,
  proteinTarget,
  steps,
  stepTarget,
  water,
  waterTarget,
  textColor,
  subTextColor,
  mode = "dark",
}: ActivityRingsProps) {
  // Higher opacity tracks in dark mode so rings don't blend into dark backgrounds
  const bigTrackOpacity = mode === "dark" ? "38" : "18";
  const smallTrackOpacity = mode === "dark" ? "40" : "20";

  // Defensive: ensure no NaN/undefined values reach SVG
  const safeCal = Number(calories) || 0;
  const safeCalTarget = Number(calorieTarget) || 2000;
  const safeProt = Number(protein) || 0;
  const safeProtTarget = Number(proteinTarget) || 150;
  const safeSteps = Number(steps) || 0;
  const safeStepTarget = Number(stepTarget) || 10000;
  const safeWater = Number(water) || 0;
  const safeWaterTarget = Number(waterTarget) || 8;

  return (
    <View style={{ alignItems: "center", paddingVertical: 4 }}>
      {/* Large calorie gauge */}
      <BigRing
        current={safeCal}
        target={safeCalTarget}
        color="#A8FF3E"
        emoji={"\uD83D\uDD25"}
        textColor={textColor}
        subTextColor={subTextColor}
        trackOpacity={bigTrackOpacity}
      />

      {/* 3 small rings below */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "flex-start",
          width: "100%",
          marginTop: 12,
        }}
      >
        <SmallRing
          current={safeProt}
          target={safeProtTarget}
          color="#4FC3F7"
          emoji={"\uD83D\uDCAA"}
          valueText={`${safeProt}g protein`}
          textColor={textColor}
          subTextColor={subTextColor}
          trackOpacity={smallTrackOpacity}
        />
        <SmallRing
          current={safeWater}
          target={safeWaterTarget}
          color="#00BCD4"
          emoji={"\uD83D\uDCA7"}
          valueText={`${safeWater}/${safeWaterTarget} glasses`}
          textColor={textColor}
          subTextColor={subTextColor}
          trackOpacity={smallTrackOpacity}
        />
        <SmallRing
          current={safeSteps}
          target={safeStepTarget}
          color="#FFB74D"
          emoji={"\uD83D\uDC63"}
          valueText={`${safeSteps.toLocaleString()} steps`}
          textColor={textColor}
          subTextColor={subTextColor}
          trackOpacity={smallTrackOpacity}
        />
      </View>
    </View>
  );
}
