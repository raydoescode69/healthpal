import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { analyzeFoodFromImage } from "../lib/foodAnalyzer";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../lib/theme";
import type { FoodAnalysisResult } from "../lib/types";

const { width: SCREEN_W } = Dimensions.get("window");

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
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const handleImageAnalysis = async (source: "camera" | "gallery") => {
    try {
      // Request permissions
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera access is needed to snap your meals.");
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Photo library access is needed to pick food images.");
          return;
        }
      }

      const pickerFn =
        source === "camera"
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      const result = await pickerFn({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      const base64Data = asset.base64!;
      setAnalyzing(true);

      const analysis = await analyzeFoodFromImage(base64Data, asset.uri);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={handleClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.modalBg,
            borderRadius: 20,
            paddingVertical: 28,
            paddingHorizontal: 24,
            width: Math.min(SCREEN_W * 0.85, 340),
            borderWidth: 1,
            borderColor: colors.modalBorder,
          }}
          onPress={() => {}}
        >
          {analyzing ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text
                style={{
                  color: colors.textTertiary,
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
                  color: colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "700",
                  marginBottom: 24,
                  textAlign: "center",
                }}
              >
                Log Food
              </Text>

              {/* Type and Add */}
              <Pressable
                onPress={() => {
                  onClose();
                  onTypeFood();
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.modalOptionBg,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="keypad-outline" size={22} color={colors.accent} />
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600", flex: 1 }}>
                    Type and Add
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>

              {/* Click and Add */}
              <Pressable
                onPress={() => handleImageAnalysis("camera")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.modalOptionBg,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="camera-outline" size={22} color={colors.accent} />
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600", flex: 1 }}>
                    Click and Add
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>

              {/* Upload from Gallery */}
              <Pressable
                onPress={() => handleImageAnalysis("gallery")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.modalOptionBg,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="images-outline" size={22} color={colors.accent} />
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600", flex: 1 }}>
                    Upload from Gallery
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: 8,
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ color: colors.subText, fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
