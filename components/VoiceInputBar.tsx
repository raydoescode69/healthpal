import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeIn,
  FadeOut,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VoiceState } from "./VoiceMode";

// Design tokens from the HTML spec
const LIME = "#bef135";
const INK = "#060607";

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

// ── Ripple ring for Activated state ──
function RippleRing({ delay, size }: { delay: number; size: number }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: "rgba(190,241,53,0.35)",
        },
        style,
      ]}
    />
  );
}

// ── Waveform bar for Listening state ──
function WaveBar({ height, delay }: { height: number; delay: number }) {
  const scaleY = useSharedValue(0.5);
  const barOpacity = useSharedValue(0.4);

  useEffect(() => {
    scaleY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
    barOpacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
    opacity: barOpacity.value,
  }));

  return (
    <Animated.View
      style={[{ width: 3, height, borderRadius: 10, backgroundColor: LIME }, style]}
    />
  );
}

// ── Breathing orb for Processing state ──
function BreathingOrb() {
  const scale = useSharedValue(0.95);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.orb, style]}>
      <View style={styles.orbInner} />
    </Animated.View>
  );
}

// ── Playback bar for Responding state ──
function PlaybackBar({ index }: { index: number }) {
  const barHeight = useSharedValue(4);
  const barOpacity = useSharedValue(0.3);

  useEffect(() => {
    const d = (index % 3) * 200 + (index % 2 === 0 ? 100 : 0);
    barHeight.value = withDelay(
      d,
      withRepeat(
        withSequence(
          withTiming(20, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(4, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
    barOpacity.value = withDelay(
      d,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    height: barHeight.value,
    opacity: barOpacity.value,
  }));

  return (
    <Animated.View
      style={[{ flex: 1, borderRadius: 10, backgroundColor: "rgba(190,241,53,0.4)" }, style]}
    />
  );
}

// ── Blinking dot ──
function BlinkingDot() {
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <Animated.View
      style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: LIME }, style]}
    />
  );
}

// Waveform bar configs from the HTML design
const WAVE_BARS = [
  { height: 10, delay: 0 },
  { height: 20, delay: 100 },
  { height: 32, delay: 150 },
  { height: 44, delay: 200 },
  { height: 36, delay: 250 },
  { height: 52, delay: 100 },
  { height: 38, delay: 50 },
  { height: 28, delay: 150 },
  { height: 18, delay: 200 },
  { height: 10, delay: 250 },
  { height: 24, delay: 100 },
  { height: 40, delay: 150 },
  { height: 52, delay: 200 },
  { height: 36, delay: 50 },
  { height: 20, delay: 100 },
];

// ── Close button (top-right on all states) ──
function CloseButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{
        position: "absolute",
        top,
        right: 22,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(245,245,240,0.08)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
    >
      <Ionicons name="close" size={18} color="rgba(245,245,240,0.5)" />
    </Pressable>
  );
}

export default function VoiceInputBar({
  state,
  transcript,
  onStop,
  onEnd,
}: VoiceInputBarProps) {
  const insets = useSafeAreaInsets();
  const closeTop = insets.top + 14;

  // ── STATE: idle (Activated / Tap - brief transition) ──
  if (state === "idle") {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        style={[styles.overlay, { backgroundColor: INK }]}
      >
        <CloseButton onPress={onEnd} top={closeTop} />

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <Text style={styles.topTime}>
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
          <Text style={styles.topNyra}>NYRA</Text>
        </View>

        {/* Ripple center */}
        <View style={styles.rippleWrap}>
          <RippleRing delay={0} size={70} />
          <RippleRing delay={350} size={110} />
          <RippleRing delay={700} size={155} />
          <View style={styles.micCore}>
            <Ionicons name="mic" size={24} color="#000" />
          </View>
        </View>

        <View style={styles.tapTextWrap}>
          <Text style={styles.tapListeningText}>I'm listening…</Text>
        </View>

        <Text style={[styles.tapCancelHint, { bottom: insets.bottom + 20 }]}>
          tap × to cancel
        </Text>
      </Animated.View>
    );
  }

  // ── STATE: listening ──
  if (state === "listening") {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        style={[styles.overlay, { backgroundColor: INK }]}
      >
        <CloseButton onPress={onEnd} top={closeTop} />

        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <Text style={styles.topTime}>
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
          <Text style={styles.topNyra}>NYRA</Text>
        </View>

        {/* Listening badge + transcript */}
        <View style={[styles.listenTop, { top: insets.top + 60 }]}>
          <View style={styles.listenBadge}>
            <BlinkingDot />
            <Text style={styles.listenBadgeText}>LISTENING</Text>
          </View>
          {transcript ? (
            <Text style={styles.userQuery}>"{transcript}"</Text>
          ) : null}
        </View>

        {/* Waveform bars */}
        <View style={styles.waveformWrap}>
          {WAVE_BARS.map((bar, i) => (
            <WaveBar key={i} height={bar.height} delay={bar.delay} />
          ))}
        </View>

        {/* Mic button — tap to stop & send */}
        <Pressable
          style={[styles.micCoreSm, { bottom: insets.bottom + 46 }]}
          onPress={onStop}
        >
          <Ionicons name="mic" size={20} color="#000" />
        </Pressable>

        <Text style={[styles.stopHint, { bottom: insets.bottom + 20 }]}>
          tap to send
        </Text>
      </Animated.View>
    );
  }

  // ── STATE: processing ──
  if (state === "processing") {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        style={[styles.overlay, { backgroundColor: INK }]}
      >
        <CloseButton onPress={onEnd} top={closeTop} />

        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <Text style={styles.topTime}>
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
          <Text style={styles.topNyra}>NYRA</Text>
        </View>

        {/* Breathing orb + text */}
        <View style={styles.processCenter}>
          <BreathingOrb />
          <View style={styles.processText}>
            <Text style={styles.ptMain}>Thinking…</Text>
            <Text style={styles.ptSub}>ANALYSING YOUR GOALS</Text>
          </View>
        </View>

        {/* Query echo */}
        {transcript ? (
          <View style={[styles.queryEcho, { bottom: insets.bottom + 60 }]}>
            <Text style={styles.queryEchoText}>"{transcript}"</Text>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  // ── STATE: speaking ──
  if (state === "speaking") {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        style={[styles.overlay, { backgroundColor: INK }]}
      >
        <CloseButton onPress={onEnd} top={closeTop} />

        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <Text style={styles.topTime}>
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
        </View>

        {/* Nyra badge + response bubble */}
        <View style={[styles.respTop, { top: insets.top + 50 }]}>
          <View style={styles.nyraBadge}>
            <View style={styles.nyraAvatar}>
              <Text style={styles.nyraAvatarText}>N</Text>
            </View>
            <Text style={styles.nyraName}>NYRA · SPEAKING</Text>
          </View>

          <View style={styles.respBubble}>
            <Text style={styles.respText}>
              {transcript || "Processing your request..."}
            </Text>
          </View>
        </View>

        {/* Playback bar */}
        <View style={[styles.playbackWrap, { bottom: insets.bottom + 108 }]}>
          <View style={styles.playBtn}>
            <Ionicons name="play" size={13} color="#000" />
          </View>
          <View style={styles.pbBars}>
            {Array.from({ length: 18 }).map((_, i) => (
              <PlaybackBar key={i} index={i} />
            ))}
          </View>
          <Text style={styles.pbTime}>0:08</Text>
        </View>

        {/* Action buttons */}
        <View style={[styles.respActions, { bottom: insets.bottom + 52 }]}>
          <Pressable style={styles.raBtn} onPress={onEnd}>
            <Ionicons name="mic-outline" size={11} color="rgba(245,245,240,0.45)" />
            <Text style={styles.raBtnText}>Ask more</Text>
          </Pressable>
          <Pressable style={[styles.raBtn, styles.raBtnPrimary]} onPress={onEnd}>
            <Ionicons name="checkmark" size={11} color={INK} />
            <Text style={[styles.raBtnText, { color: INK }]}>Done</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    zIndex: 2,
  },
  topTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(245,245,240,0.55)",
  },
  topNyra: {
    fontSize: 10,
    letterSpacing: 1,
    color: "rgba(245,245,240,0.22)",
    fontWeight: "500",
  },

  // Activated / idle
  rippleWrap: {
    position: "absolute",
    bottom: 140,
    alignSelf: "center",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  micCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 12,
  },
  tapTextWrap: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
  },
  tapListeningText: {
    fontSize: 18,
    fontStyle: "italic",
    color: "rgba(245,245,240,0.5)",
  },
  tapCancelHint: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 10,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    color: "rgba(245,245,240,0.3)",
  },

  // Listening
  listenTop: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
  },
  listenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(190,241,53,0.25)",
    borderRadius: 100,
  },
  listenBadgeText: {
    fontSize: 9,
    letterSpacing: 1.44,
    color: LIME,
    opacity: 0.8,
    fontWeight: "500",
  },
  userQuery: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 20,
    fontStyle: "italic",
    color: "rgba(245,245,240,0.6)",
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  waveformWrap: {
    position: "absolute",
    bottom: 160,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  micCoreSm: {
    position: "absolute",
    alignSelf: "center",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  stopHint: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 10,
    color: "rgba(245,245,240,0.25)",
    letterSpacing: 0.4,
  },

  // Processing
  processCenter: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    alignItems: "center",
    gap: 28,
  },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(190,241,53,0.15)",
    borderWidth: 1,
    borderColor: "rgba(190,241,53,0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 8,
  },
  orbInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(190,241,53,0.6)",
  },
  processText: {
    alignItems: "center",
  },
  ptMain: {
    fontSize: 18,
    fontStyle: "italic",
    color: "rgba(245,245,240,0.7)",
    marginBottom: 6,
  },
  ptSub: {
    fontSize: 9,
    letterSpacing: 1.62,
    color: "rgba(245,245,240,0.2)",
    fontWeight: "500",
  },
  queryEcho: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "rgba(245,245,240,0.03)",
    borderWidth: 1,
    borderColor: "rgba(245,245,240,0.07)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  queryEchoText: {
    fontSize: 11,
    fontStyle: "italic",
    color: "rgba(245,245,240,0.3)",
    lineHeight: 16.5,
    textAlign: "center",
  },

  // Responding / speaking
  respTop: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
  },
  nyraBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  nyraAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  nyraAvatarText: {
    fontSize: 13,
    fontStyle: "italic",
    color: INK,
    fontWeight: "500",
  },
  nyraName: {
    fontSize: 9,
    letterSpacing: 1.44,
    color: "rgba(245,245,240,0.35)",
    fontWeight: "500",
  },
  respBubble: {
    marginTop: 14,
    width: "100%",
    backgroundColor: "rgba(245,245,240,0.04)",
    borderWidth: 1,
    borderColor: "rgba(245,245,240,0.08)",
    borderRadius: 18,
    padding: 16,
  },
  respText: {
    fontSize: 17,
    lineHeight: 26,
    color: "rgba(245,245,240,0.82)",
    letterSpacing: -0.17,
  },
  playbackWrap: {
    position: "absolute",
    left: 22,
    right: 22,
    backgroundColor: "rgba(190,241,53,0.05)",
    borderWidth: 1,
    borderColor: "rgba(190,241,53,0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  pbBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    height: 28,
  },
  pbTime: {
    fontSize: 10,
    color: "rgba(190,241,53,0.5)",
    fontWeight: "500",
  },
  respActions: {
    position: "absolute",
    left: 22,
    right: 22,
    flexDirection: "row",
    gap: 8,
  },
  raBtn: {
    flex: 1,
    height: 34,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(245,245,240,0.08)",
    backgroundColor: "rgba(245,245,240,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  raBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(245,245,240,0.45)",
  },
  raBtnPrimary: {
    backgroundColor: LIME,
    borderColor: LIME,
  },
});
