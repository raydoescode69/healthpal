import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import type { ConversationItem, UserProfile } from "../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

interface ChatSidebarProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  currentConversationId: string | null;
  onSelectConversation: (conv: ConversationItem) => void;
  onNewChat: () => void;
  profile: UserProfile | null;
  onLogout: () => void;
}

const GOAL_DISPLAY: Record<string, { emoji: string; label: string }> = {
  lose_weight: { emoji: "\uD83D\uDD25", label: "Lose Weight" },
  gain_muscle: { emoji: "\uD83D\uDCAA", label: "Gain Muscle" },
  eat_healthy: { emoji: "\uD83E\uDD57", label: "Eat Healthy" },
  manage_stress: { emoji: "\uD83E\uDDD8", label: "Manage Stress" },
};

const DIET_DISPLAY: Record<string, string> = {
  veg: "Vegetarian",
  non_veg: "Non-Veg",
  vegan: "Vegan",
  keto: "Keto",
  no_preference: "No Pref",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[d.getMonth()]}`;
}

function groupByDate(conversations: ConversationItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: ConversationItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.created_at);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= last7) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ChatSidebar({
  visible,
  onClose,
  userId,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  profile,
  onLogout,
}: ChatSidebarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setConversations(data);
    } catch {}
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      fetchConversations();
      translateX.value = withTiming(0, { duration: 250 });
      overlayOpacity.value = withTiming(0.5, { duration: 250 });
    } else {
      translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: 200 });
      overlayOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => setShouldRender(false), 250);
    }
  }, [visible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible && !shouldRender) return null;

  const grouped = groupByDate(conversations);
  const goalInfo = profile?.goal ? GOAL_DISPLAY[profile.goal] : null;
  const dietLabel = profile?.diet_type ? DIET_DISPLAY[profile.diet_type] : null;
  const initial = profile?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
      }}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Dim overlay */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
          },
          overlayStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sidebar drawer */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_WIDTH,
            backgroundColor: "#111111",
            borderRightWidth: 1,
            borderRightColor: "#1F1F1F",
          },
          sidebarStyle,
        ]}
      >
        {/* Profile section */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#1F1F1F" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Avatar circle */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#1A2E0A",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: "#A8FF3E",
              }}
            >
              <Text style={{ color: "#A8FF3E", fontSize: 18, fontWeight: "bold" }}>
                {initial}
              </Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
                {profile?.name || "User"}
              </Text>
              {/* Goal + diet badges */}
              <View style={{ flexDirection: "row", marginTop: 4, flexWrap: "wrap", gap: 6 }}>
                {goalInfo && (
                  <View style={{ backgroundColor: "#1A1A1A", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: "#999", fontSize: 11 }}>
                      {goalInfo.emoji} {goalInfo.label}
                    </Text>
                  </View>
                )}
                {dietLabel && (
                  <View style={{ backgroundColor: "#1A1A1A", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: "#999", fontSize: 11 }}>
                      {dietLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* New Chat button */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Pressable
            onPress={() => {
              onNewChat();
              onClose();
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#333" : "#2A2A2A",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#3A3A3A",
            })}
          >
            <Text style={{ color: "#ddd", fontWeight: "700", fontSize: 15 }}>
              + New Chat
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#1F1F1F", marginHorizontal: 16 }} />

        {/* Dashboard link */}
        <Pressable
          onPress={() => {
            router.push("/(main)/dashboard");
            onClose();
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginHorizontal: 16,
            marginTop: 14,
            marginBottom: 6,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: pressed ? "#1A1A1A" : "transparent",
          })}
        >
          <Text style={{ color: "#ccc", fontWeight: "500", fontSize: 14 }}>
            Dashboard
          </Text>
          <Text style={{ color: "#555", fontSize: 16 }}>{"\u203A"}</Text>
        </Pressable>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#1F1F1F", marginHorizontal: 16, marginTop: 8, marginBottom: 4 }} />

        {/* Chat history header with count */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ color: "#777", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Chat History
          </Text>
          {conversations.length > 0 && (
            <View style={{ backgroundColor: "#1A2E0A", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: "#A8FF3E", fontSize: 11, fontWeight: "600" }}>
                {conversations.length}
              </Text>
            </View>
          )}
        </View>

        {/* Conversations list */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color="#A8FF3E" size="small" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center", paddingHorizontal: 24 }}>
              <Text style={{ color: "#444", fontSize: 13, textAlign: "center" }}>
                No conversations yet. Start chatting!
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label} style={{ marginTop: 16 }}>
                <Text style={{ color: "#666", fontSize: 12, fontWeight: "700", textTransform: "uppercase", paddingHorizontal: 20, marginBottom: 8, letterSpacing: 0.8 }}>
                  {group.label}
                </Text>
                {group.items.map((conv, idx) => {
                  const isActive = conv.id === currentConversationId;
                  const displayTitle =
                    (conv.title || "New conversation").length > 34
                      ? (conv.title || "New conversation").slice(0, 34) + "..."
                      : conv.title || "New conversation";
                  return (
                    <View key={conv.id}>
                      <Pressable
                        onPress={() => {
                          onSelectConversation(conv);
                          onClose();
                        }}
                        style={({ pressed }) => ({
                          marginHorizontal: 10,
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderRadius: 10,
                          backgroundColor: isActive ? "#1a2e0a" : pressed ? "#1A1A1A" : "transparent",
                          borderLeftWidth: isActive ? 3 : 0,
                          borderLeftColor: "#A8FF3E",
                          flexDirection: "row",
                          alignItems: "center",
                        })}
                      >
                        <Text style={{ color: isActive ? "#A8FF3E" : "#555", fontSize: 14, marginRight: 10 }}>
                          {"\uD83D\uDCAC"}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ color: isActive ? "#fff" : "#ccc", fontSize: 15, fontWeight: "500" }}
                            numberOfLines={1}
                          >
                            {displayTitle}
                          </Text>
                          <Text style={{ color: "#555", fontSize: 11, marginTop: 3 }}>
                            {formatDate(conv.created_at)}
                          </Text>
                        </View>
                      </Pressable>
                      {idx < group.items.length - 1 && (
                        <View style={{ height: 1, backgroundColor: "#1A1A1A", marginHorizontal: 26 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Logout button at bottom */}
        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1F1F1F" }}>
          <Pressable
            onPress={() => {
              onLogout();
              onClose();
            }}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: pressed ? "#2a1a1a" : "#1A1A1A",
            })}
          >
            <Text style={{ color: "#E57373", fontWeight: "600", fontSize: 14 }}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
