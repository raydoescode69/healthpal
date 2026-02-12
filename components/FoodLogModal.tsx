import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { analyzeFoodFromImage } from "../lib/foodAnalyzer";
import type { FoodAnalysisResult } from "../lib/types";

interface FoodLogModalProps {
  visible: boolean;
  onClose: () => void;
  onTypeFood: () => void;
  onFoodAnalyzed: (result: FoodAnalysisResult, imageUri?: string) => void;
}

export default function FoodLogModal({
  visible,
  onClose,
  onTypeFood,
  onFoodAnalyzed,
}: FoodLogModalProps) {
  const [analyzing, setAnalyzing] = useState(false);

  const handleImageAnalysis = async (
    source: "camera" | "gallery"
  ) => {
    try {
      const pickerFn =
        source === "camera"
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      const result = await pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      const base64Data = asset.base64!;
      setAnalyzing(true);

      const analysis = await analyzeFoodFromImage(base64Data);
      setAnalyzing(false);
      onClose();
      onFoodAnalyzed(analysis, asset.uri);
    } catch (err: any) {
      setAnalyzing(false);
      Alert.alert(
        "Analysis Failed",
        err?.message || "Could not analyze the image. Try again or type instead."
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "flex-end",
        }}
        onPress={!analyzing ? onClose : undefined}
      >
        <Pressable
          style={{
            backgroundColor: "#161616",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 40,
          }}
          onPress={() => {}}
        >
          {analyzing ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <ActivityIndicator color="#A8FF3E" size="large" />
              <Text
                style={{
                  color: "#888",
                  marginTop: 16,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              >
                Analyzing your food...
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                Log Food
              </Text>

              {/* Type option */}
              <Pressable
                onPress={() => {
                  onClose();
                  onTypeFood();
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: pressed ? "#222" : "#1A1A1A",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                })}
              >
                <Text style={{ fontSize: 24, marginRight: 14 }}>
                  {"\u2328\uFE0F"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}
                  >
                    Type what you ate
                  </Text>
                  <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                    Describe your meal in text
                  </Text>
                </View>
              </Pressable>

              {/* Camera option */}
              <Pressable
                onPress={() => handleImageAnalysis("camera")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: pressed ? "#222" : "#1A1A1A",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                })}
              >
                <Text style={{ fontSize: 24, marginRight: 14 }}>
                  {"\uD83D\uDCF7"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}
                  >
                    Take a photo
                  </Text>
                  <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                    Snap your meal for AI analysis
                  </Text>
                </View>
              </Pressable>

              {/* Gallery option */}
              <Pressable
                onPress={() => handleImageAnalysis("gallery")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: pressed ? "#222" : "#1A1A1A",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: "#2a2a2a",
                })}
              >
                <Text style={{ fontSize: 24, marginRight: 14 }}>
                  {"\uD83D\uDDBC\uFE0F"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}
                  >
                    Pick from gallery
                  </Text>
                  <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                    Choose a photo from your library
                  </Text>
                </View>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={onClose}
                style={{ alignItems: "center", paddingTop: 8 }}
              >
                <Text style={{ color: "#666", fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
