import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";

const API_BASE = "https://api.cartesia.ai";
const CARTESIA_VERSION = "2025-04-16";
const DEFAULT_VOICE_ID = "95d51f79-c397-46f9-b49a-23763d3eaa2d";

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_CARTESIA_API_KEY;
  if (!key || key === "your-key-here") {
    throw new Error("Cartesia API key not configured");
  }
  return key;
}

/** Convert a Blob to a base64 string using FileReader (RN-compatible) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to extract base64 from blob"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Speech-to-Text using Cartesia Ink Whisper
 */
export async function speechToText(audioUri: string): Promise<string> {
  const apiKey = getApiKey();
  console.log("[Cartesia STT] Starting transcription...");
  console.log("[Cartesia STT] Audio URI:", audioUri);

  const formData = new FormData();
  formData.append("file", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  formData.append("model", "ink-whisper");
  formData.append("language", "en");

  console.log("[Cartesia STT] Sending request to Cartesia...");
  const response = await fetch(`${API_BASE}/stt`, {
    method: "POST",
    headers: {
      "Cartesia-Version": CARTESIA_VERSION,
      "X-API-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Cartesia STT] Error:", response.status, errText);
    throw new Error(`Cartesia STT ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.text?.trim() || "";
  console.log("[Cartesia STT] Transcription result:", text);
  return text;
}

/**
 * Text-to-Speech using Cartesia Sonic 3
 * Returns a local file URI for playback
 */
export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<string> {
  const apiKey = getApiKey();
  console.log("[Cartesia TTS] Starting speech generation...");
  console.log("[Cartesia TTS] Text length:", text.length, "chars");
  console.log("[Cartesia TTS] Voice ID:", voiceId);

  const response = await fetch(`${API_BASE}/tts/bytes`, {
    method: "POST",
    headers: {
      "Cartesia-Version": CARTESIA_VERSION,
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-3",
      transcript: text,
      voice: {
        mode: "id",
        id: voiceId,
      },
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        sample_rate: 24000,
      },
      language: "en",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Cartesia TTS] Error:", response.status, errText);
    throw new Error(`Cartesia TTS ${response.status}: ${errText}`);
  }

  console.log("[Cartesia TTS] Received audio response, converting to file...");

  // React Native Blob doesn't have arrayBuffer(), use FileReader instead
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  const fileUri = `${cacheDirectory}tts_${Date.now()}.wav`;
  await writeAsStringAsync(fileUri, base64, {
    encoding: EncodingType.Base64,
  });

  console.log("[Cartesia TTS] Audio saved to:", fileUri);
  return fileUri;
}
