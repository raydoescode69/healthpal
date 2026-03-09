import { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    MediaLibrary.usePermissions();
  const [latestPhoto, setLatestPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const permissionsGranted =
    cameraPermission?.granted && mediaPermission?.granted;

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        const cam = await requestCameraPermission();
        if (!cam.granted) {
          Alert.alert(
            "Permission Required",
            "Camera access is needed to snap your meals."
          );
        }
      }
      if (!mediaPermission?.granted) {
        const media = await requestMediaPermission();
        if (!media.granted) {
          Alert.alert(
            "Permission Required",
            "Photo library access is needed to show recent photos."
          );
        }
      }
    })();
  }, []);

  // Fetch latest photo from camera roll
  const fetchLatestPhoto = useCallback(async () => {
    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        first: 1,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: MediaLibrary.MediaType.photo,
      });
      if (assets.length > 0) {
        // On Android, asset.uri may be a content:// URI that Image can't render.
        // Use getAssetInfoAsync to get the file:// localUri.
        const info = await MediaLibrary.getAssetInfoAsync(assets[0]);
        setLatestPhoto(info.localUri || assets[0].uri);
      }
    } catch (e) {
      console.log("[Camera] Failed to fetch latest photo:", e);
    }
  }, []);

  useEffect(() => {
    if (mediaPermission?.granted) {
      fetchLatestPhoto();
    }
  }, [mediaPermission?.granted, fetchLatestPhoto]);

  // Capture photo
  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      if (photo?.uri) {
        // Save to media library so thumbnail updates
        await MediaLibrary.createAssetAsync(photo.uri);
        fetchLatestPhoto();
        router.push({
          pathname: "/(main)/track-food",
          params: { imageUri: photo.uri, base64: photo.base64 },
        });
      }
    } catch (err: any) {
      Alert.alert("Capture Failed", "Could not take photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  // Pick from gallery
  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        router.push({
          pathname: "/(main)/track-food",
          params: { imageUri: asset.uri, base64: asset.base64 },
        });
      }
    } catch {
      Alert.alert("Error", "Could not open gallery. Please try again.");
    }
  };

  // Permission denied fallback
  if (cameraPermission && !cameraPermission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="camera-outline" size={64} color="#555" />
        <Text style={styles.permissionText}>Camera access is required</Text>
        <Text style={styles.permissionSubtext}>
          Please enable camera permission in your device settings.
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera preview */}
      {permissionsGranted && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
      )}

      {/* Top bar — close button */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Gallery thumbnail */}
        <Pressable onPress={handlePickGallery} style={styles.thumbnailWrapper}>
          {latestPhoto ? (
            <Image
              source={{ uri: latestPhoto }}
              style={styles.thumbnail}
              onError={() => setLatestPhoto(null)}
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Ionicons name="images-outline" size={24} color="#fff" />
            </View>
          )}
        </Pressable>

        {/* Capture button */}
        <Pressable
          onPress={handleCapture}
          disabled={capturing}
          style={({ pressed }) => [
            styles.captureOuter,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View
            style={[
              styles.captureInner,
              capturing && { backgroundColor: "#999" },
            ]}
          />
        </Pressable>

        {/* Spacer to balance layout */}
        <View style={styles.thumbnailWrapper} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  thumbnailWrapper: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  thumbnailPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
  },
  permissionText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  permissionSubtext: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  backButton: {
    marginTop: 24,
    backgroundColor: "#222",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
