import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";

const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  if (!key || key === "your-key-here") {
    throw new Error("ElevenLabs API key not configured");
  }
  return key;
}

/** Convert a Blob to a base64 string using FileReader (RN-compatible) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:audio/mpeg;base64,AAAA..."
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
 * Speech-to-Text using ElevenLabs Scribe v1
 */
export async function speechToText(audioUri: string): Promise<string> {
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append("file", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  formData.append("model_id", "scribe_v1");

  const response = await fetch(`${API_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs STT ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.text?.trim() || "";
}

/**
 * Text-to-Speech using ElevenLabs
 * Returns a local file URI for playback
 */
export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs TTS ${response.status}: ${errText}`);
  }

  // React Native Blob doesn't have arrayBuffer(), use FileReader instead
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  const fileUri = `${cacheDirectory}tts_${Date.now()}.mp3`;
  await writeAsStringAsync(fileUri, base64, {
    encoding: EncodingType.Base64,
  });

  return fileUri;
}
