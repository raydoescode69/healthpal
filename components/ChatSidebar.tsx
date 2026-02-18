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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../lib/theme";
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

const GOAL_DISPLAY: Record<string, string> = {
  lose_weight: "Lose Weight",
  gain_muscle: "Gain Muscle",
  eat_healthy: "Eat Healthy",
  manage_stress: "Manage Stress",
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
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];
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
  const goalLabel = profile?.goal ? GOAL_DISPLAY[profile.goal] : null;
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
            backgroundColor: colors.sidebarBg,
          },
          sidebarStyle,
        ]}
      >
        {/* ── Profile section ── */}
        <View style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.accentDark,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: colors.accent,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 18, fontWeight: "bold" }}>
                {initial}
              </Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
                {profile?.name || "User"}
              </Text>
              {(goalLabel || dietLabel) && (
                <Text style={{ color: colors.subText, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                  {[goalLabel, dietLabel].filter(Boolean).join("  \u00B7  ")}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          {/* New Chat */}
          <Pressable
            onPress={() => { onNewChat(); onClose(); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.accentDark : colors.sidebarButtonBg,
              borderRadius: 12,
              paddingVertical: 13,
              paddingHorizontal: 16,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 22, alignItems: "center" }}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              </View>
              <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14, marginLeft: 10 }}>
                New Chat
              </Text>
            </View>
          </Pressable>

          {/* Dashboard */}
          <Pressable
            onPress={() => { router.push("/(main)/dashboard"); onClose(); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.sidebarButtonPressBg : colors.sidebarButtonBg,
              borderRadius: 12,
              paddingVertical: 13,
              paddingHorizontal: 16,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 22, alignItems: "center" }}>
                <Ionicons name="stats-chart-outline" size={16} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 14, marginLeft: 10, flex: 1 }}>
                Dashboard
              </Text>
              <View style={{ width: 18, alignItems: "center" }}>
                <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* ── Separator ── */}
        <View style={{ height: 1, backgroundColor: colors.separator, marginHorizontal: 20 }} />

        {/* ── Chat history header ── */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 10,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
            Conversations
          </Text>
          {conversations.length > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
              {conversations.length}
            </Text>
          )}
        </View>

        {/* ── Conversations list ── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 24 }}>
              <Text style={{ color: colors.textFaint, fontSize: 13, textAlign: "center" }}>
                No conversations yet.{"\n"}Start chatting!
              </Text>
            </View>
          ) : (
            grouped.map((group, groupIdx) => (
              <View key={group.label} style={{ marginBottom: 12 }}>
                {groupIdx > 0 && (
                  <View style={{ height: 1, backgroundColor: colors.separator, marginHorizontal: 20, marginBottom: 4 }} />
                )}
                <Text style={{
                  color: colors.textFaint,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: 10,
                }}>
                  {group.label}
                </Text>
                {group.items.map((conv) => {
                  const isActive = conv.id === currentConversationId;
                  const title = conv.title || "New conversation";
                  const displayTitle = title.length > 30 ? title.slice(0, 30) + "..." : title;
                  return (
                    <Pressable
                      key={conv.id}
                      onPress={() => { onSelectConversation(conv); onClose(); }}
                      style={({ pressed }) => ({
                        marginHorizontal: 12,
                        marginVertical: 3,
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        borderRadius: 10,
                        backgroundColor: isActive ? colors.sidebarItemActiveBg : pressed ? colors.sidebarButtonBg : "transparent",
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 20, marginRight: 10, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons
                            name={isActive ? "chatbubble" : "chatbubble-outline"}
                            size={14}
                            color={isActive ? colors.accent : colors.textFaint}
                          />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: isActive ? colors.pinnedText : colors.textSecondary,
                            fontSize: 14,
                            fontWeight: isActive ? "600" : "400",
                          }}
                          numberOfLines={1}
                        >
                          {displayTitle}
                        </Text>
                        <Text style={{ color: colors.textFaint, fontSize: 10, marginLeft: 8 }}>
                          {formatDate(conv.created_at)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Sign out ── */}
        <View style={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}>
          <Pressable
            onPress={() => { onLogout(); onClose(); }}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: pressed ? colors.dangerBg : colors.widgetBg,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 20, alignItems: "center", marginRight: 8 }}>
                <Ionicons name="log-out-outline" size={16} color={colors.danger} />
              </View>
              <Text style={{ color: colors.danger, fontWeight: "600", fontSize: 14 }}>
                Sign Out
              </Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
