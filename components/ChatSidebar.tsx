import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
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
import type { Session } from "@supabase/supabase-js";
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
  session: Session | null;
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

const GOAL_COLORS: Record<string, string> = {
  lose_weight: "#FF6B6B",
  gain_muscle: "#4ECDC4",
  eat_healthy: "#A8FF3E",
  manage_stress: "#C084FC",
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
  session,
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
  const goalColor = profile?.goal ? GOAL_COLORS[profile.goal] || colors.accent : colors.accent;

  // Get user info from Google auth metadata, fallback to profile
  const userMeta = session?.user?.user_metadata;
  const avatarUrl = userMeta?.avatar_url || userMeta?.picture || null;
  const displayName = profile?.name || userMeta?.full_name || userMeta?.name || session?.user?.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

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
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Avatar — Google profile pic or fallback initial */}
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.sidebarProfileGlow,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 6,
            }}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.accentDark,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.accent, fontSize: 20, fontWeight: "bold" }}>
                    {initial}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>
                {displayName}
              </Text>
              {/* Badge chips */}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
                {goalLabel && (
                  <View style={{
                    backgroundColor: goalColor + "20",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: goalColor + "40",
                  }}>
                    <Text style={{ color: goalColor, fontSize: 11, fontWeight: "600" }}>
                      {goalLabel}
                    </Text>
                  </View>
                )}
                {dietLabel && (
                  <View style={{
                    backgroundColor: colors.accent + "18",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.accent + "30",
                  }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "600" }}>
                      {dietLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
          {/* New Chat — Hero CTA */}
          <Pressable
            onPress={() => { onNewChat(); onClose(); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.sidebarNewChatPressBg : colors.sidebarNewChatBg,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.accent + "30",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}>
                <Ionicons name="add" size={16} color="#000" />
              </View>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 15 }}>
                New Chat
              </Text>
            </View>
          </Pressable>

          {/* Dashboard — Secondary */}
          <Pressable
            onPress={() => { router.push("/(main)/dashboard"); onClose(); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.sidebarButtonPressBg : colors.sidebarButtonBg,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: colors.widgetIconBg,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}>
                <Ionicons name="stats-chart-outline" size={14} color={colors.accent} />
              </View>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 14, flex: 1 }}>
                Dashboard
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
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
          paddingTop: 18,
          paddingBottom: 10,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
            Conversations
          </Text>
          {conversations.length > 0 && (
            <View style={{
              backgroundColor: colors.accent + "18",
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 10,
              minWidth: 22,
              alignItems: "center",
            }}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>
                {conversations.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Conversations list ── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={{ paddingVertical: 50, alignItems: "center", paddingHorizontal: 30 }}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 4 }}>
                No conversations yet
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
                Tap "New Chat" above to start your health journey
              </Text>
            </View>
          ) : (
            grouped.map((group, groupIdx) => (
              <View key={group.label} style={{ marginBottom: 4 }}>
                {/* Date group header */}
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingTop: groupIdx > 0 ? 16 : 4,
                  paddingBottom: 8,
                }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: colors.separator }} />
                  <Text style={{
                    color: colors.textFaint,
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    paddingHorizontal: 10,
                  }}>
                    {group.label}
                  </Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: colors.separator }} />
                </View>
                {group.items.map((conv) => {
                  const isActive = conv.id === currentConversationId;
                  const title = conv.title || "New conversation";
                  const displayTitle = title.length > 28 ? title.slice(0, 28) + "..." : title;
                  return (
                    <Pressable
                      key={conv.id}
                      onPress={() => { onSelectConversation(conv); onClose(); }}
                      style={({ pressed }) => ({
                        marginHorizontal: 10,
                        marginVertical: 2,
                        borderRadius: 10,
                        overflow: "hidden",
                        backgroundColor: isActive ? colors.sidebarItemActiveBg : pressed ? colors.sidebarButtonBg : "transparent",
                      })}
                    >
                      <View style={{ flexDirection: "row" }}>
                        {/* Left accent bar for active item */}
                        <View style={{
                          width: 3,
                          backgroundColor: isActive ? colors.sidebarAccentBar : "transparent",
                          borderRadius: 2,
                        }} />
                        <View style={{
                          flex: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 11,
                        }}>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Sign out — understated text link ── */}
        <View style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
        }}>
          <Pressable
            onPress={() => { onLogout(); onClose(); }}
            style={({ pressed }) => ({
              paddingVertical: 8,
              opacity: pressed ? 0.5 : 0.7,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="log-out-outline" size={18} color={colors.subText} />
              <Text style={{ color: colors.subText, fontSize: 16, fontWeight: "600" }}>
                Sign out
              </Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
