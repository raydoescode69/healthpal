import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { analyzeFoodFromImage } from "../lib/foodAnalyzer";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../lib/theme";
import CameraWithGallery from "./CameraWithGallery";
import type { FoodAnalysisResult } from "../lib/types";

interface FoodLogModalProps {
  visible: boolean;
  onClose: () => void;
  onTypeFood: () => void;
  onFoodAnalyzed: (result: FoodAnalysisResult, imageUri?: string) => void;
}

const OPTIONS = [
  { key: "type", icon: "create-outline" as const, label: "Type", desc: "Describe what you ate" },
  { key: "camera", icon: "camera-outline" as const, label: "Camera", desc: "Snap your meal" },
  { key: "gallery", icon: "images-outline" as const, label: "Gallery", desc: "Pick from photos" },
];

export default function FoodLogModal({
  visible,
  onClose,
  onTypeFood,
  onFoodAnalyzed,
}: FoodLogModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const handleGalleryPick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Photo library access is needed to pick food images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      setAnalyzing(true);

      const analysis = await analyzeFoodFromImage(asset.base64!, asset.uri);
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

  const handleClose = () => {
    if (analyzing) return;
    onClose();
  };

  const handleCameraClose = () => {
    setCameraOpen(false);
  };

  const handleCameraFoodAnalyzed = (result: FoodAnalysisResult, imageUri?: string) => {
    setCameraOpen(false);
    onClose();
    onFoodAnalyzed(result, imageUri);
  };

  const handleOption = (key: string) => {
    if (key === "type") {
      onClose();
      onTypeFood();
    } else if (key === "camera") {
      // Open inline camera — don't close this modal first (race condition)
      setCameraOpen(true);
    } else {
      handleGalleryPick();
    }
  };

  // When camera is open, render CameraWithGallery instead of the options sheet
  if (cameraOpen) {
    return (
      <CameraWithGallery
        visible={true}
        onClose={handleCameraClose}
        onFoodAnalyzed={handleCameraFoodAnalyzed}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        onPress={handleClose}
      >
        <Pressable onPress={() => {}}>
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textFaint + "50" }} />
            </View>

            {analyzing ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={{ color: colors.subText, marginTop: 14, fontSize: 15, fontWeight: "500" }}>
                  Analyzing your food...
                </Text>
              </View>
            ) : (
              <>
                {/* Title */}
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginBottom: 16 }}>
                  Track Calories
                </Text>

                {/* Options */}
                <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => handleOption(opt.key)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.accent + "10" : colors.separator + "40",
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name={opt.icon} size={22} color={colors.accent} style={{ marginRight: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                          {opt.desc}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </View>
                  </Pressable>
                ))}
                </View>

                {/* Cancel */}
                <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
                  <Pressable
                    onPress={handleClose}
                    style={({ pressed }) => ({
                      paddingVertical: 13,
                      alignItems: "center",
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.separator : colors.separator + "60",
                    })}
                  >
                    <Text style={{ color: colors.subText, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
