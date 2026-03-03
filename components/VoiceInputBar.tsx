import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { VoiceState } from "./VoiceMode";

interface VoiceInputBarProps {
  state: VoiceState;
  transcript: string;
  onStop: () => void;
  onEnd: () => void;
  accentColor: string;
  bgColor: string;
  textColor: string;
  subTextColor: string;
}

const STATUS_TEXT: Record<VoiceState, string> = {
  idle: "Starting...",
  listening: "Listening...",
  processing: "Thinking...",
  speaking: "Speaking...",
};

function PulseIndicator({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.4, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

export default function VoiceInputBar({
  state,
  transcript,
  onStop,
  onEnd,
  accentColor,
  bgColor,
  textColor,
  subTextColor,
}: VoiceInputBarProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: bgColor,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Status indicator */}
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
        {state === "listening" && <PulseIndicator color="#FF4444" />}
        {state === "processing" && (
          <Ionicons name="hourglass-outline" size={16} color={subTextColor} />
        )}
        {state === "speaking" && (
          <Ionicons name="volume-high-outline" size={16} color={accentColor} />
        )}
        {state === "idle" && (
          <Ionicons name="mic-outline" size={16} color={subTextColor} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontSize: 14, fontWeight: "500" }}>
            {STATUS_TEXT[state]}
          </Text>
          {transcript ? (
            <Text
              style={{ color: subTextColor, fontSize: 12, marginTop: 2 }}
              numberOfLines={1}
            >
              "{transcript}"
            </Text>
          ) : null}
        </View>
      </View>

      {/* Stop recording button (only during listening) */}
      {state === "listening" && (
        <Pressable
          onPress={onStop}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#FF4444",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="stop" size={20} color="#fff" />
        </Pressable>
      )}

      {/* End voice session button */}
      <Pressable
        onPress={onEnd}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        }}
      >
        <Text style={{ color: subTextColor, fontSize: 12, fontWeight: "600" }}>
          End
        </Text>
      </Pressable>
    </View>
  );
}
