import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { analyzeFoodFromImage } from "../../lib/foodAnalyzer";
import { useTrackingStore } from "../../store/useTrackingStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES } from "../../lib/theme";
import FoodResultCard from "../../components/FoodResultCard";
import type { FoodAnalysisResult } from "../../lib/types";

export default function TrackFoodScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id || "";
  const saveFoodLog = useTrackingStore((s) => s.saveFoodLog);
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const pickImage = async (source: "camera" | "gallery") => {
    try {
      setResult(null);
      setSaved(false);

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

      const pickerResult = await pickerFn({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.base64) return;

      const asset = pickerResult.assets[0];
      setImageUri(asset.uri);
      setAnalyzing(true);

      const analysis = await analyzeFoodFromImage(asset.base64!, asset.uri);
      setResult(analysis);
      setAnalyzing(false);
    } catch (err: any) {
      setAnalyzing(false);
      Alert.alert(
        "Analysis Failed",
        err?.message || "Could not analyze the image. Please try again."
      );
    }
  };

  const handleConfirm = async (edited: FoodAnalysisResult) => {
    if (!userId) return;
    try {
      await saveFoodLog(userId, edited, imageUri);
      setSaved(true);
    } catch {
      Alert.alert("Error", "Could not save food log. Try again.");
    }
  };

  const handleRetake = () => {
    setResult(null);
    setImageUri(undefined);
    setSaved(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          paddingHorizontal: 20,
          backgroundColor: colors.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.headerBorder,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.widgetBorder, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.headerText, fontSize: 18, fontWeight: "700", marginLeft: 14 }}>
          Snap & Track
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved success */}
        {saved && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View
              style={{
                backgroundColor: colors.accentDark,
                borderWidth: 1,
                borderColor: colors.accentBorder,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 18, fontWeight: "700", marginTop: 10 }}>
                Food Logged!
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                Your meal has been tracked successfully
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable
                  onPress={() => router.push("/(main)/dashboard")}
                  style={{
                    flex: 1,
                    backgroundColor: colors.accent,
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: mode === "dark" ? "#000" : "#fff", fontWeight: "700", fontSize: 14 }}>
                    View Dashboard
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRetake}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.widgetBorder,
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                    Track More
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Result card */}
        {result && !saved && (
          <View style={{ marginBottom: 20 }}>
            <FoodResultCard
              result={result}
              imageUri={imageUri}
              onConfirm={handleConfirm}
              onRetake={handleRetake}
            />
          </View>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View
              style={{
                backgroundColor: colors.widgetBg,
                borderWidth: 1,
                borderColor: colors.widgetBorder,
                borderRadius: 20,
                padding: 40,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={{ color: colors.textTertiary, fontSize: 15, fontWeight: "500", marginTop: 16 }}>
                Analyzing your food...
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 6 }}>
                AI is identifying items and estimating nutrition
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Source selection — show when no result and not analyzing */}
        {!result && !analyzing && !saved && (
          <>
            <Animated.View entering={FadeInDown.delay(0).duration(400)}>
              <View style={{ alignItems: "center", marginBottom: 30, marginTop: 20 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: colors.accentDark,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="camera" size={36} color={colors.accent} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>
                  Snap Your Meal
                </Text>
                <Text style={{ color: colors.subText, fontSize: 14, marginTop: 6, textAlign: "center", paddingHorizontal: 20 }}>
                  Take a photo or pick from gallery and AI will estimate the calories and macros
                </Text>
              </View>
            </Animated.View>

            {/* Camera option */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Pressable
                onPress={() => pickImage("camera")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.widgetBg,
                  borderWidth: 1,
                  borderColor: colors.widgetBorder,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 12,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="camera" size={24} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
                      Take a Photo
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 13, marginTop: 3 }}>
                      Snap your meal with the camera
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>
            </Animated.View>

            {/* Gallery option */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Pressable
                onPress={() => pickImage("gallery")}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.modalOptionPressBg : colors.widgetBg,
                  borderWidth: 1,
                  borderColor: colors.widgetBorder,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 12,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: colors.accentDark,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="images" size={24} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
                      Pick from Gallery
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 13, marginTop: 3 }}>
                      Choose from your photo library
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>
            </Animated.View>

            {/* Tips */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View
                style={{
                  backgroundColor: colors.widgetBg,
                  borderWidth: 1,
                  borderColor: colors.widgetBorder,
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  Tips for best results
                </Text>
                <TipRow icon="sunny-outline" text="Good lighting helps AI identify food better" colors={colors} />
                <TipRow icon="scan-outline" text="Capture all items in a single frame" colors={colors} />
                <TipRow icon="resize-outline" text="Get close enough to see the food clearly" colors={colors} />
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TipRow({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  colors: typeof THEMES.dark;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
      <Ionicons name={icon} size={16} color={colors.textFaint} style={{ marginRight: 10 }} />
      <Text style={{ color: colors.subText, fontSize: 13, flex: 1 }}>{text}</Text>
    </View>
  );
}
