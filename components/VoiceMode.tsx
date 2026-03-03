import { useState, useRef, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { speechToText, textToSpeech } from "../lib/cartesiaService";
import { sendMessage } from "../lib/chatEngine";

const MAX_RECORDING_MS = 30000;

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface UseVoiceChatOptions {
  userId: string;
  conversationId: string;
  messageHistory: { role: "user" | "assistant"; content: string }[];
  dietPlanAlreadyShown: boolean;
  onNewMessages: (userText: string, botText: string) => void;
}

export function useVoiceChat({
  userId,
  conversationId,
  messageHistory,
  dietPlanAlreadyShown,
  onNewMessages,
}: UseVoiceChatOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const playerRef = useRef<AudioPlayer | null>(null);
  const isStoppingRef = useRef(false);
  const activeRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const cleanup = useCallback(() => {
    try { recorder.stop(); } catch {}
    try {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
    } catch {}
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    setState("idle");
    setTranscript("");
    isStoppingRef.current = false;
    activeRef.current = false;
  }, []);

  const startRecording = useCallback(async () => {
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

      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current && activeRef.current) {
          handleStop();
        }
      }, MAX_RECORDING_MS);
    } catch (err: any) {
      console.warn("[VoiceChat] Start recording failed:", err?.message || err);
      if (activeRef.current) {
        setState("idle");
      }
    }
  }, []);

  const stopRecordingAndProcess = useCallback(async () => {
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

      const userText = await speechToText(uri);

      if (!userText.trim()) {
        if (activeRef.current) {
          isStoppingRef.current = false;
          startRecording();
        }
        return;
      }

      setTranscript(userText);

      const response = await sendMessage(
        userId,
        conversationId,
        userText,
        messageHistory,
        dietPlanAlreadyShown
      );

      const botText = response.bubbles.join(" ");
      const audioUri = await textToSpeech(botText);

      onNewMessages(userText, botText);

      if (!activeRef.current) return;
      setState("speaking");

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      const player = createAudioPlayer({ uri: audioUri });
      playerRef.current = player;

      let hasFinished = false;
      player.addListener("playbackStatusUpdate", (status: any) => {
        // Detect playback completion: not playing, loaded, and reached end
        if (
          !hasFinished &&
          status.isLoaded !== false &&
          status.playing === false &&
          status.currentTime > 0 &&
          status.duration > 0 &&
          status.currentTime >= status.duration - 0.5
        ) {
          hasFinished = true;
          try { player.remove(); } catch {}
          playerRef.current = null;

          if (activeRef.current) {
            isStoppingRef.current = false;
            setTranscript("");
            startRecording();
          } else {
            setState("idle");
          }
        }
      });

      player.play();
    } catch (err: any) {
      console.warn("[VoiceChat] Processing failed:", err?.message || err);
      isStoppingRef.current = false;

      if (activeRef.current) {
        setState("idle");
        Alert.alert("Error", String(err?.message || "Something went wrong"));
      }
    }
  }, [userId, conversationId, messageHistory, dietPlanAlreadyShown, onNewMessages, startRecording]);

  const handleStop = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    stopRecordingAndProcess();
  }, [stopRecordingAndProcess]);

  const start = useCallback(async () => {
    activeRef.current = true;
    setTranscript("");
    await startRecording();
  }, [startRecording]);

  const stop = useCallback(() => {
    if (state === "listening") {
      handleStop();
    }
  }, [state, handleStop]);

  const end = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    state,
    transcript,
    start,
    stop,
    end,
    isActive: activeRef.current,
  };
}
