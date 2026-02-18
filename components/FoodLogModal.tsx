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
  const [showCameraChoice, setShowCameraChoice] = useState(false);
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const handleImageAnalysis = async (source: "camera" | "gallery") => {
    try {
      setShowCameraChoice(false);

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
    setShowCameraChoice(false);
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
          ) : showCameraChoice ? (
            <>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "700",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                Choose Source
              </Text>

              {/* Camera */}
              <Pressable
                onPress={() => handleImageAnalysis("camera")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.modalOptionBg,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="camera" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                      Take a Photo
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                      Snap your meal now
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Gallery */}
              <Pressable
                onPress={() => handleImageAnalysis("gallery")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.modalOptionBg,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="images" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                      Pick from Gallery
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                      Choose from your library
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Back */}
              <Pressable
                onPress={() => setShowCameraChoice(false)}
                style={{ alignItems: "center", paddingTop: 8 }}
              >
                <Text style={{ color: colors.subText, fontSize: 14 }}>Back</Text>
              </Pressable>
            </>
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

              {/* Type and Log */}
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
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                      Type and Log
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 3 }}>
                      Describe your meal in text
                    </Text>
                  </View>
                  <View style={{ width: 20, alignItems: "center" }}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </View>
              </Pressable>

              {/* Click and Log */}
              <Pressable
                onPress={() => setShowCameraChoice(true)}
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
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                      Click and Log
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 3 }}>
                      Take or pick a photo for AI analysis
                    </Text>
                  </View>
                  <View style={{ width: 20, alignItems: "center" }}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </View>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={handleClose}
                style={{ alignItems: "center", paddingTop: 6 }}
              >
                <Text style={{ color: colors.subText, fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
