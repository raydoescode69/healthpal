import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { speechToText, textToSpeech } from "../lib/elevenLabsService";
import { sendMessage } from "../lib/chatEngine";
import ParticleSphere from "./ParticleSphere";

const { width: SCREEN_W } = Dimensions.get("window");
const SPHERE_SIZE = Math.min(SCREEN_W * 0.7, 300);

const MAX_RECORDING_MS = 30000; // Safety cutoff at 30s

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceModeProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  conversationId: string;
  messageHistory: { role: "user" | "assistant"; content: string }[];
  dietPlanAlreadyShown: boolean;
  onNewMessages: (userText: string, botText: string) => void;
}

const STATUS_TEXT: Record<VoiceState, string> = {
  idle: "Starting...",
  listening: "Listening...",
  processing: "Thinking...",
  speaking: "Speaking...",
};

export default function VoiceMode({
  visible,
  onClose,
  userId,
  conversationId,
  messageHistory,
  dietPlanAlreadyShown,
  onNewMessages,
}: VoiceModeProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const playerRef = useRef<AudioPlayer | null>(null);
  const isStoppingRef = useRef(false);
  const visibleRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Auto-start recording when modal opens
  useEffect(() => {
    if (visible) {
      setTranscript("");
      // Small delay for modal animation to finish
      const timer = setTimeout(() => {
        if (visibleRef.current) {
          startRecording();
        }
      }, 600);
      return () => clearTimeout(timer);
    } else {
      // Cleanup on close
      try { recorder.stop(); } catch {}
      try {
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }
      } catch {}
      setState("idle");
      setTranscript("");
      isStoppingRef.current = false;
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
      }
    }
  }, [visible]);

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice mode.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      isStoppingRef.current = false;
      setState("listening");
      console.log("[VoiceMode] Recording started");

      // Safety: auto-stop after max duration
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current && visibleRef.current) {
          console.log("[VoiceMode] Max duration reached, auto-stopping");
          handleStop();
        }
      }, MAX_RECORDING_MS);
    } catch (err: any) {
      console.warn("[VoiceMode] Start recording failed:", err?.message || err);
      // Don't show alert if we're closing
      if (visibleRef.current) {
        setState("idle");
      }
    }
  };

  const stopRecordingAndProcess = async () => {
    setState("processing");
    setTranscript("");

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording URI");

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // STT
      console.log("[VoiceMode] Transcribing...");
      const userText = await speechToText(uri);
      console.log("[VoiceMode] Transcript:", userText);

      if (!userText.trim()) {
        console.log("[VoiceMode] Empty transcript, restarting recording");
        // No speech detected — restart recording automatically
        if (visibleRef.current) {
          isStoppingRef.current = false;
          startRecording();
        }
        return;
      }

      setTranscript(userText);

      // Get AI response
      console.log("[VoiceMode] Getting AI response...");
      const response = await sendMessage(
        userId,
        conversationId,
        userText,
        messageHistory,
        dietPlanAlreadyShown
      );

      const botText = response.bubbles.join(" ");
      console.log("[VoiceMode] Bot:", botText.slice(0, 80));

      // TTS
      console.log("[VoiceMode] Generating speech...");
      const audioUri = await textToSpeech(botText);

      // Sync messages to chat history
      onNewMessages(userText, botText);

      // Play audio
      if (!visibleRef.current) return; // User closed during processing
      setState("speaking");

      const player = createAudioPlayer(audioUri);
      playerRef.current = player;

      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          player.remove();
          playerRef.current = null;

          // Auto-loop: start recording again after bot finishes speaking
          if (visibleRef.current) {
            console.log("[VoiceMode] Speech done, auto-restarting recording");
            isStoppingRef.current = false;
            setTranscript("");
            startRecording();
          } else {
            setState("idle");
          }
        }
      });

      player.play();
      console.log("[VoiceMode] Playing response audio");
    } catch (err: any) {
      console.warn("[VoiceMode] Processing failed:", err?.message || err);
      isStoppingRef.current = false;

      if (visibleRef.current) {
        // On error, try to restart recording so the loop continues
        Alert.alert("Error", String(err?.message || "Something went wrong"), [
          {
            text: "Try Again",
            onPress: () => startRecording(),
          },
          {
            text: "Close",
            onPress: () => onClose(),
            style: "cancel",
          },
        ]);
      }
    }
  };

  const handleStop = () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    stopRecordingAndProcess();
  };

  const handleMicPress = () => {
    if (state === "listening") {
      handleStop();
    }
  };

  const handleClose = async () => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    try { await recorder.stop(); } catch {}
    try {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
    } catch {}
    onClose();
  };

  const micColor = state === "listening" ? "#FF4444" : "rgba(255,255,255,0.1)";
  const showMicButton = state === "listening";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Close button */}
        <Pressable
          onPress={handleClose}
          style={{
            position: "absolute",
            top: insets.top + 12,
            right: 20,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {/* Status text */}
        <Text
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 16,
            marginBottom: 40,
            fontWeight: "500",
          }}
        >
          {STATUS_TEXT[state]}
        </Text>

        {/* Particle sphere */}
        <ParticleSphere
          isSpeaking={state === "speaking"}
          isListening={state === "listening"}
          size={SPHERE_SIZE}
        />

        {/* Transcript preview */}
        {transcript ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 14,
              marginTop: 30,
              paddingHorizontal: 40,
              textAlign: "center",
              fontStyle: "italic",
            }}
            numberOfLines={3}
          >
            "{transcript}"
          </Text>
        ) : (
          <View style={{ height: 50, marginTop: 30 }} />
        )}

        {/* Mic button — visible during listening as a tap-to-stop fallback */}
        <Pressable
          onPress={handleMicPress}
          disabled={!showMicButton}
          style={{
            marginTop: 20,
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: showMicButton ? micColor : "transparent",
            alignItems: "center",
            justifyContent: "center",
            opacity: showMicButton ? 1 : 0.3,
          }}
        >
          {showMicButton && (
            <Ionicons name="stop" size={32} color="#000" />
          )}
        </Pressable>

        {/* Hint text */}
        <Text
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            marginTop: 12,
          }}
        >
          {state === "listening"
            ? "Tap when done speaking"
            : state === "processing"
            ? ""
            : state === "speaking"
            ? "Will listen again after response"
            : ""}
        </Text>

        {/* End session button */}
        <Pressable
          onPress={handleClose}
          style={{
            position: "absolute",
            bottom: insets.bottom + 30,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" }}>
            End Session
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
