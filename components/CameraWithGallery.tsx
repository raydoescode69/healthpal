import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, Modal, ScrollView, Image, ActivityIndicator, Alert, StatusBar, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { analyzeFoodFromImage } from "../lib/foodAnalyzer";
import type { FoodAnalysisResult } from "../lib/types";

const THUMB = 68;

interface GalleryPhoto {
  id: string;
  uri: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodAnalyzed: (result: FoodAnalysisResult, imageUri?: string) => void;
}

export default function CameraWithGallery({ visible, onClose, onFoodAnalyzed }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [camReady, setCamReady] = useState(false);

  // Load gallery photos when modal opens
  useEffect(() => {
    if (!visible) { setCamReady(false); return; }

    let cancelled = false;

    (async () => {
      try {
        if (!camPerm?.granted) await requestCamPerm();

        const { status } = await MediaLibrary.requestPermissionsAsync();

        if (status === "granted" && !cancelled) {
          setGalleryLoading(true);

          const media = await MediaLibrary.getAssetsAsync({
            first: 15,
            mediaType: "photo",
            sortBy: [MediaLibrary.SortBy.creationTime],
          });

          const resolved: GalleryPhoto[] = [];
          for (const asset of media.assets) {
            if (cancelled) break;
            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset);
              const fileUri = info.localUri || asset.uri;
              resolved.push({ id: asset.id, uri: fileUri });
            } catch {
              resolved.push({ id: asset.id, uri: asset.uri });
            }
          }

          if (!cancelled) {
            setPhotos(resolved);
            setGalleryLoading(false);
          }
        }
      } catch {
        setGalleryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  const onCameraReady = useCallback(() => {
    setCamReady(true);
  }, []);

  const capture = useCallback(async () => {
    if (!cameraRef.current || analyzing || !camReady) return;

    try {
      setAnalyzing(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

      let b64 = photo?.base64;
      if (!b64 && photo?.uri) {
        b64 = await readAsStringAsync(photo.uri, { encoding: EncodingType.Base64 });
      }
      if (!b64) {
        setAnalyzing(false);
        Alert.alert("Error", "Could not capture photo.");
        return;
      }

      const result = await analyzeFoodFromImage(b64, photo?.uri);
      setAnalyzing(false);
      onClose();
      onFoodAnalyzed(result, photo?.uri);
    } catch (err: any) {
      setAnalyzing(false);
      Alert.alert("Error", err?.message || "Failed to analyze image.");
    }
  }, [analyzing, camReady, onClose, onFoodAnalyzed]);

  const pickFromGallery = useCallback(async (photo: GalleryPhoto) => {
    if (analyzing) return;

    try {
      setAnalyzing(true);
      const b64 = await readAsStringAsync(photo.uri, { encoding: EncodingType.Base64 });
      const result = await analyzeFoodFromImage(b64, photo.uri);
      setAnalyzing(false);
      onClose();
      onFoodAnalyzed(result, photo.uri);
    } catch (err: any) {
      setAnalyzing(false);
      Alert.alert("Error", err?.message || "Failed to analyze image.");
    }
  }, [analyzing, onClose, onFoodAnalyzed]);

  const close = useCallback(() => {
    if (analyzing) return;
    onClose();
  }, [analyzing, onClose]);

  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={s.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Full-screen camera preview */}
        <View style={s.cameraBox}>
          {camPerm?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash ? "on" : "off"}
              onCameraReady={onCameraReady}
            />
          ) : (
            <View style={s.noPerm}>
              <Ionicons name="camera-outline" size={48} color="#555" />
              <Text style={{ color: "#999", marginTop: 10, fontSize: 14 }}>Camera permission needed</Text>
              <Pressable onPress={() => requestCamPerm()} style={s.grantBtn}>
                <Text style={{ color: "#000", fontWeight: "700" }}>Grant Access</Text>
              </Pressable>
            </View>
          )}

          {/* Top controls overlaid on camera */}
          <View style={[s.topRow, { top: insets.top + 8 }]}>
            <Pressable onPress={close} style={s.circleBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => setFlash(f => !f)}
              style={[s.circleBtn, flash && { backgroundColor: "rgba(168,255,62,0.35)" }]}
            >
              <Ionicons name={flash ? "flash" : "flash-off"} size={20} color={flash ? "#A8FF3E" : "#fff"} />
            </Pressable>
          </View>

          {/* Gallery strip + shutter OVERLAID on camera bottom */}
          <View style={[s.bottomOverlay, { paddingBottom: bottomPad }]}>
            {/* Gallery thumbnails */}
            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.galleryScroll}>
                {photos.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => pickFromGallery(p)}
                    style={({ pressed }) => [s.thumbWrap, pressed && { opacity: 0.5 }]}
                  >
                    <Image source={{ uri: p.uri }} style={s.thumbImg} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {galleryLoading && (
              <View style={s.galleryLoadingRow}>
                <ActivityIndicator color="#888" size="small" />
                <Text style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>Loading gallery...</Text>
              </View>
            )}

            {/* Shutter button */}
            <View style={s.shutterRow}>
              <Pressable
                onPress={capture}
                disabled={analyzing || !camPerm?.granted || !camReady}
                style={({ pressed }) => [
                  s.shutter,
                  pressed && { transform: [{ scale: 0.92 }] },
                  (analyzing || !camReady) && { opacity: 0.4 },
                ]}
              >
                <View style={s.shutterInner} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Analyzing overlay */}
        {analyzing && (
          <View style={s.overlay}>
            <ActivityIndicator color="#A8FF3E" size="large" />
            <Text style={{ color: "#fff", marginTop: 14, fontSize: 16, fontWeight: "600" }}>
              Analyzing your food...
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  cameraBox: { flex: 1, overflow: "hidden" },
  noPerm: { flex: 1, alignItems: "center", justifyContent: "center" },
  grantBtn: {
    marginTop: 14, backgroundColor: "#A8FF3E",
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  topRow: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, zIndex: 5,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },

  // Inline overlay at the bottom of camera
  bottomOverlay: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingTop: 10,
  },

  galleryScroll: {
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  thumbWrap: {
    width: THUMB, height: THUMB,
    borderRadius: 8, marginHorizontal: 3,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "#333",
  },
  thumbImg: {
    width: THUMB, height: THUMB,
  },

  galleryLoadingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },

  shutterRow: {
    alignItems: "center",
    paddingVertical: 12,
  },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  shutterInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#fff",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center",
    zIndex: 50,
  },
});
