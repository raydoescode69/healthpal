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
import { supabase } from "../lib/supabase";
import type { ConversationItem } from "../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.75;

interface ChatSidebarProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  currentConversationId: string | null;
  onSelectConversation: (conv: ConversationItem) => void;
  onNewChat: () => void;
}

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
}: ChatSidebarProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      console.log("[ChatSidebar] fetch conversations:", { count: data?.length, error: error?.message, userId });

      if (data) setConversations(data);
    } catch (e) {
      console.log("[ChatSidebar] fetch error:", e);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (visible) {
      fetchConversations();
      translateX.value = withTiming(0, { duration: 250 });
      overlayOpacity.value = withTiming(0.5, { duration: 250 });
    } else {
      translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: 200 });
      overlayOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!visible && translateX.value === -SIDEBAR_WIDTH) return null;

  const grouped = groupByDate(conversations);

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
      {/* Dim overlay — tap to close */}
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
            backgroundColor: "#141414",
            borderRightWidth: 1,
            borderRightColor: "#222",
          },
          sidebarStyle,
        ]}
      >
        {/* Header */}
        <View className="pt-14 px-4 pb-3 border-b border-[#222]">
          <Text className="text-white font-sora-semibold text-[20px] mb-3">
            Chats
          </Text>
          <Pressable
            onPress={() => {
              onNewChat();
              onClose();
            }}
            className="bg-[#1A2E0A] rounded-xl py-3 items-center active:opacity-70"
          >
            <Text className="text-[#A8FF3E] font-sora-semibold text-[14px]">
              + New Chat
            </Text>
          </Pressable>
        </View>

        {/* Conversations list */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator color="#A8FF3E" size="small" />
            </View>
          ) : conversations.length === 0 ? (
            <View className="py-8 items-center px-6">
              <Text className="text-[#555] font-dm text-[13px] text-center">
                No conversations yet. Start chatting!
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label} className="mt-4">
                <Text className="text-[#666] font-dm text-[11px] font-semibold uppercase px-4 mb-2">
                  {group.label}
                </Text>
                {group.items.map((conv, idx) => {
                  const isActive = conv.id === currentConversationId;
                  const displayTitle =
                    (conv.title || "New conversation").length > 40
                      ? (conv.title || "New conversation").slice(0, 40) + "..."
                      : conv.title || "New conversation";
                  return (
                    <View key={conv.id}>
                      <Pressable
                        onPress={() => {
                          onSelectConversation(conv);
                          onClose();
                        }}
                        style={isActive ? { backgroundColor: "#1a3a1a" } : undefined}
                        className="px-4 py-3 mx-2 rounded-lg active:opacity-70"
                      >
                        <Text
                          className="text-white font-dm text-[14px]"
                          numberOfLines={1}
                        >
                          {displayTitle}
                        </Text>
                        <Text className="text-[#666] font-dm text-[11px] mt-1">
                          {formatDate(conv.created_at)}
                        </Text>
                      </Pressable>
                      {idx < group.items.length - 1 && (
                        <View className="mx-4" style={{ height: 1, backgroundColor: "#222" }} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
