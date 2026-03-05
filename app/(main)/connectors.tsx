import { useState } from "react";
import { View, Text, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES } from "../../lib/theme";
import { usePedometer } from "../../lib/usePedometer";

const GOOGLE_BLUE = "#4285F4";

interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  platform: "android" | "ios" | "all";
  dataTypes: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[];
}

const CONNECTORS: ConnectorConfig[] = [
  {
    id: "health-connect",
    name: "Google Health Connect",
    description: "Sync step count data from Health Connect on Android.",
    icon: "fitness-outline",
    color: GOOGLE_BLUE,
    platform: "android",
    dataTypes: [{ label: "Steps", icon: "footsteps-outline" }],
  },
];

export default function ConnectorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];
  const pedometer = usePedometer();

  const [connecting, setConnecting] = useState(false);
  const isHealthConnectConnected = pedometer.source === "health-connect";

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: colors.headerBorder,
          backgroundColor: colors.headerBg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textTertiary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            Connectors
          </Text>
        </View>
        {/* Spacer to balance the back button */}
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      <View style={{ padding: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
          Connect external health services to sync your data automatically.
        </Text>

        {CONNECTORS.map((connector) => {
          // Only show connectors relevant to current platform
          if (connector.platform !== "all" && Platform.OS !== connector.platform) {
            return null;
          }

          const isConnected = connector.id === "health-connect" && isHealthConnectConnected;

          return (
            <View
              key={connector.id}
              style={{
                backgroundColor: colors.cardBg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isConnected ? colors.accent + "40" : colors.cardBorder,
                padding: 18,
                marginBottom: 12,
              }}
            >
              {/* Top row: icon + name + status */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: connector.color + "18",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={connector.icon} size={22} color={connector.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                    {connector.name}
                  </Text>
                  <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                    {connector.description}
                  </Text>
                </View>
                {/* Status dot */}
                <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isConnected ? "#4CAF50" : "#666",
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={{
                      color: isConnected ? "#4CAF50" : colors.textFaint,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {isConnected ? "Connected" : "Not connected"}
                  </Text>
                </View>
              </View>

              {/* Data synced chips */}
              {isConnected && connector.dataTypes.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ color: colors.subText, fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Data synced
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {connector.dataTypes.map((dt) => (
                      <View
                        key={dt.label}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: colors.accentDark,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.accent + "30",
                        }}
                      >
                        <Ionicons name={dt.icon} size={14} color={colors.accent} style={{ marginRight: 5 }} />
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
                          {dt.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Connect / Disconnect button */}
              <Pressable
                onPress={async () => {
                  if (isConnected) {
                    pedometer.refresh();
                    return;
                  }
                  setConnecting(true);
                  try {
                    const success = await pedometer.connect();
                    if (success) {
                      Alert.alert("Connected", "Health Connect is now syncing your step data.");
                    } else {
                      Alert.alert(
                        "Connection Failed",
                        pedometer.error || "Make sure Health Connect is installed and permissions are granted."
                      );
                    }
                  } catch {
                    Alert.alert("Error", "Could not connect to Health Connect.");
                  } finally {
                    setConnecting(false);
                  }
                }}
                disabled={connecting}
                style={({ pressed }) => ({
                  backgroundColor: isConnected
                    ? "transparent"
                    : pressed
                      ? colors.accentDark
                      : colors.accent,
                  borderWidth: isConnected ? 1 : 0,
                  borderColor: isConnected ? colors.accent + "50" : undefined,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: connecting ? 0.6 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {connecting ? (
                    <ActivityIndicator size="small" color={isConnected ? colors.accent : "#000"} style={{ marginRight: 6 }} />
                  ) : isConnected ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  ) : null}
                  <Text
                    style={{
                      color: isConnected ? colors.accent : "#000",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {connecting ? "Connecting..." : isConnected ? "Connected" : "Connect"}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        {/* Show note for iOS users */}
        {Platform.OS === "ios" && (
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600" }}>
                More connectors coming soon
              </Text>
            </View>
            <Text style={{ color: colors.subText, fontSize: 13, lineHeight: 18 }}>
              Apple Health and other integrations are on the way.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
