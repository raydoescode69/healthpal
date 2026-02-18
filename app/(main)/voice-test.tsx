/**
 * Voice Mode Diagnostic Test Screen
 * Navigate here to test each step of the voice pipeline independently.
 * Access via: /(main)/voice-test
 */
import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import { cacheDirectory } from "expo-file-system/legacy";
import { speechToText, textToSpeech } from "../../lib/elevenLabsService";
import { sendMessage } from "../../lib/chatEngine";
import { useAuthStore } from "../../store/useAuthStore";

type TestStatus = "idle" | "running" | "pass" | "fail";

interface TestResult {
  status: TestStatus;
  message: string;
  duration?: number;
}

const TESTS = [
  "API Key Check",
  "Mic Permission",
  "Audio Mode (Record)",
  "Record 2s Audio",
  "ElevenLabs STT",
  "GPT-4o Response",
  "ElevenLabs TTS",
  "Audio Playback",
] as const;

type TestName = (typeof TESTS)[number];

export default function VoiceTestScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id || "";

  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [sttText, setSttText] = useState<string | null>(null);
  const [botResponse, setBotResponse] = useState<string | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const updateResult = useCallback((name: string, result: TestResult) => {
    setResults((prev) => ({ ...prev, [name]: result }));
  }, []);

  const runAllTests = async () => {
    setIsRunning(true);
    setResults({});
    setRecordingUri(null);
    setSttText(null);
    setBotResponse(null);
    setTtsUri(null);

    // Test 1: API Key Check
    const t1 = "API Key Check";
    updateResult(t1, { status: "running", message: "Checking..." });
    try {
      const key = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
      if (!key || key === "your-key-here") {
        throw new Error("Key missing or placeholder");
      }
      updateResult(t1, {
        status: "pass",
        message: `Key found: ${key.slice(0, 8)}...${key.slice(-4)}`,
      });
    } catch (e: any) {
      updateResult(t1, { status: "fail", message: e.message });
      setIsRunning(false);
      return;
    }

    // Test 2: Mic Permission
    const t2 = "Mic Permission";
    updateResult(t2, { status: "running", message: "Requesting..." });
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error(`Permission denied: ${perm.status}`);
      }
      updateResult(t2, { status: "pass", message: `Granted` });
    } catch (e: any) {
      updateResult(t2, { status: "fail", message: e.message });
      setIsRunning(false);
      return;
    }

    // Test 3: Audio Mode
    const t3 = "Audio Mode (Record)";
    updateResult(t3, { status: "running", message: "Setting..." });
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      updateResult(t3, { status: "pass", message: "Audio mode set" });
    } catch (e: any) {
      updateResult(t3, { status: "fail", message: e.message });
      setIsRunning(false);
      return;
    }

    // Test 4: Record 2s Audio
    const t4 = "Record 2s Audio";
    updateResult(t4, { status: "running", message: "Recording for 2 seconds..." });
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      await new Promise((r) => setTimeout(r, 2500));
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("recorder.uri is null after stop");
      setRecordingUri(uri);
      updateResult(t4, { status: "pass", message: `URI: ${uri.slice(-30)}` });
    } catch (e: any) {
      updateResult(t4, { status: "fail", message: String(e?.message || e) });
      setIsRunning(false);
      return;
    }

    // Test 5: ElevenLabs STT
    const t5 = "ElevenLabs STT";
    updateResult(t5, { status: "running", message: "Transcribing..." });
    const sttStart = Date.now();
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const text = await speechToText(recordingUri || recorder.uri || "");
      const dur = Date.now() - sttStart;
      if (!text.trim()) {
        updateResult(t5, {
          status: "pass",
          message: `Empty transcript (silence?) — ${dur}ms`,
          duration: dur,
        });
        // Use fallback text for remaining tests
        setSttText("hello, tell me something about health");
      } else {
        setSttText(text);
        updateResult(t5, {
          status: "pass",
          message: `"${text.slice(0, 50)}" — ${dur}ms`,
          duration: dur,
        });
      }
    } catch (e: any) {
      updateResult(t5, {
        status: "fail",
        message: String(e?.message || e),
        duration: Date.now() - sttStart,
      });
      setIsRunning(false);
      return;
    }

    // Test 6: GPT-4o Response
    const t6 = "GPT-4o Response";
    const inputText = sttText || "hello, tell me something about health";
    updateResult(t6, { status: "running", message: `Sending: "${inputText.slice(0, 30)}..."` });
    const gptStart = Date.now();
    try {
      const response = await sendMessage(userId, "test-conv", inputText, [], false);
      const text = response.bubbles.join(" ");
      const dur = Date.now() - gptStart;
      setBotResponse(text);
      updateResult(t6, {
        status: "pass",
        message: `"${text.slice(0, 50)}..." — ${dur}ms`,
        duration: dur,
      });
    } catch (e: any) {
      updateResult(t6, {
        status: "fail",
        message: String(e?.message || e),
        duration: Date.now() - gptStart,
      });
      setIsRunning(false);
      return;
    }

    // Test 7: ElevenLabs TTS
    const t7 = "ElevenLabs TTS";
    const ttsInput = botResponse || "Hello, how are you doing today?";
    updateResult(t7, { status: "running", message: "Generating speech..." });
    const ttsStart = Date.now();
    try {
      const uri = await textToSpeech(ttsInput);
      const dur = Date.now() - ttsStart;
      setTtsUri(uri);
      updateResult(t7, {
        status: "pass",
        message: `File: ${uri.slice(-30)} — ${dur}ms`,
        duration: dur,
      });
    } catch (e: any) {
      updateResult(t7, {
        status: "fail",
        message: String(e?.message || e),
        duration: Date.now() - ttsStart,
      });
      setIsRunning(false);
      return;
    }

    // Test 8: Audio Playback
    const t8 = "Audio Playback";
    const playUri = ttsUri;
    updateResult(t8, { status: "running", message: "Playing..." });
    try {
      if (!playUri) throw new Error("No TTS URI to play");
      const player = createAudioPlayer(playUri);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          player.remove();
          reject(new Error("Playback timed out after 15s"));
        }, 15000);

        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            clearTimeout(timeout);
            player.remove();
            resolve();
          }
        });

        player.play();
      });

      updateResult(t8, { status: "pass", message: "Playback completed!" });
    } catch (e: any) {
      updateResult(t8, { status: "fail", message: String(e?.message || e) });
    }

    setIsRunning(false);
  };

  const statusColor = (s: TestStatus) => {
    if (s === "pass") return "#A8FF3E";
    if (s === "fail") return "#FF4444";
    if (s === "running") return "#FFD700";
    return "#666";
  };

  const statusIcon = (s: TestStatus) => {
    if (s === "pass") return " PASS";
    if (s === "fail") return " FAIL";
    if (s === "running") return " ...";
    return "";
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      <Text
        style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: "bold",
          textAlign: "center",
          marginVertical: 16,
        }}
      >
        Voice Pipeline Diagnostics
      </Text>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {TESTS.map((name) => {
          const r = results[name];
          return (
            <View
              key={name}
              style={{
                backgroundColor: "#111",
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderLeftWidth: 3,
                borderLeftColor: r ? statusColor(r.status) : "#333",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                {name}
                <Text style={{ color: statusColor(r?.status || "idle"), fontSize: 13 }}>
                  {statusIcon(r?.status || "idle")}
                </Text>
              </Text>
              {r && (
                <Text
                  style={{ color: "#999", fontSize: 12, marginTop: 4 }}
                  numberOfLines={3}
                >
                  {r.message}
                </Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={runAllTests}
          disabled={isRunning}
          style={{
            backgroundColor: isRunning ? "#333" : "#A8FF3E",
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: isRunning ? "#888" : "#000", fontSize: 16, fontWeight: "bold" }}>
            {isRunning ? "Running Tests..." : "Run All Tests"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
