import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
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
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.72;

// ── Theme helpers ───────────────────────────────────
const dk = {
  bg: "#0a0a0d",
  border: "rgba(255,255,255,0.07)",
  avatarBg: "linear-gradient(135deg,#182806,#091808)",
  avatarBgFallback: "#0f1a08",
  avatarBorder: "rgba(190,241,53,0.22)",
  name: "#f5f5f0",
  tagGoalBg: "rgba(190,241,53,0.08)",
  tagGoalBorder: "rgba(190,241,53,0.18)",
  tagGoalText: "rgba(190,241,53,0.75)",
  tagDietBg: "rgba(255,255,255,0.04)",
  tagDietBorder: "rgba(255,255,255,0.08)",
  tagDietText: "rgba(255,255,255,0.4)",
  ncBg: "rgba(190,241,53,0.08)",
  ncBorder: "rgba(190,241,53,0.14)",
  ncLabel: "rgba(255,255,255,0.85)",
  dbBg: "rgba(255,255,255,0.03)",
  dbBorder: "rgba(255,255,255,0.07)",
  dbIconBg: "rgba(255,255,255,0.06)",
  dbIconColor: "rgba(255,255,255,0.45)",
  dbLabel: "rgba(255,255,255,0.55)",
  dbArr: "rgba(255,255,255,0.2)",
  divider: "rgba(255,255,255,0.06)",
  convTitle: "rgba(255,255,255,0.2)",
  convCount: "rgba(255,255,255,0.3)",
  convCountBg: "rgba(255,255,255,0.06)",
  group: "rgba(255,255,255,0.18)",
  rowBg: "transparent",
  rowActiveBg: "rgba(190,241,53,0.05)",
  rowIconBg: "rgba(255,255,255,0.05)",
  rowIconColor: "rgba(255,255,255,0.28)",
  rowActiveIconBg: "rgba(190,241,53,0.1)",
  rowActiveIconColor: "#bef135",
  rowName: "rgba(255,255,255,0.58)",
  rowActiveName: "rgba(255,255,255,0.88)",
  rowDate: "rgba(255,255,255,0.2)",
  bottomBorder: "rgba(255,255,255,0.06)",
  signoutIconBg: "rgba(255,255,255,0.04)",
  signoutIconColor: "rgba(255,255,255,0.25)",
  signoutLabel: "rgba(255,255,255,0.28)",
  editIcon: "rgba(255,255,255,0.2)",
  scrim: "rgba(7,7,10,0.65)",
};

const lt = {
  bg: "#f8f5ef",
  border: "rgba(12,10,8,0.08)",
  avatarBgFallback: "#0e1a06",
  avatarBorder: "rgba(190,241,53,0.3)",
  name: "#0c0a08",
  tagGoalBg: "rgba(12,10,8,0.06)",
  tagGoalBorder: "rgba(12,10,8,0.12)",
  tagGoalText: "rgba(12,10,8,0.58)",
  tagDietBg: "rgba(12,10,8,0.04)",
  tagDietBorder: "rgba(12,10,8,0.09)",
  tagDietText: "rgba(12,10,8,0.42)",
  ncBg: "#0c0a08",
  ncBorder: "#0c0a08",
  ncLabel: "rgba(248,245,239,0.9)",
  dbBg: "#fff",
  dbBorder: "rgba(12,10,8,0.09)",
  dbIconBg: "rgba(12,10,8,0.05)",
  dbIconColor: "rgba(12,10,8,0.45)",
  dbLabel: "rgba(12,10,8,0.65)",
  dbArr: "rgba(12,10,8,0.25)",
  divider: "rgba(12,10,8,0.08)",
  convTitle: "rgba(12,10,8,0.28)",
  convCount: "rgba(12,10,8,0.4)",
  convCountBg: "rgba(12,10,8,0.07)",
  group: "rgba(12,10,8,0.28)",
  rowBg: "transparent",
  rowActiveBg: "#fff",
  rowIconBg: "rgba(12,10,8,0.05)",
  rowIconColor: "rgba(12,10,8,0.32)",
  rowActiveIconBg: "rgba(12,10,8,0.08)",
  rowActiveIconColor: "rgba(12,10,8,0.6)",
  rowName: "rgba(12,10,8,0.55)",
  rowActiveName: "#0c0a08",
  rowDate: "rgba(12,10,8,0.28)",
  bottomBorder: "rgba(12,10,8,0.08)",
  signoutIconBg: "rgba(12,10,8,0.05)",
  signoutIconColor: "rgba(12,10,8,0.28)",
  signoutLabel: "rgba(12,10,8,0.32)",
  editIcon: "rgba(12,10,8,0.22)",
  scrim: "rgba(240,237,231,0.7)",
};

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
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
  const t = mode === "dark" ? dk : lt;
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
      overlayOpacity.value = withTiming(1, { duration: 250 });
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

  const userMeta = session?.user?.user_metadata;
  const avatarUrl = userMeta?.avatar_url || userMeta?.picture || null;
  const displayName = profile?.name || userMeta?.full_name || userMeta?.name || session?.user?.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={s.root} pointerEvents={visible ? "auto" : "none"}>
      {/* Scrim overlay */}
      <Animated.View style={[s.scrim, { backgroundColor: t.scrim }, overlayStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          s.drawer,
          {
            width: SIDEBAR_WIDTH,
            backgroundColor: t.bg,
            borderRightWidth: 1,
            borderRightColor: t.border,
          },
          sidebarStyle,
        ]}
      >
        {/* ── Profile ── */}
        <View style={[s.profile, { paddingTop: insets.top + 18 }]}>
          <View style={s.profileRow}>
            {/* Avatar */}
            <View
              style={[
                s.avatar,
                {
                  backgroundColor: t.avatarBgFallback,
                  borderColor: t.avatarBorder,
                },
              ]}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarInitial}>{initial}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[s.name, { color: t.name }]} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={s.tags}>
                {goalLabel && (
                  <View
                    style={[
                      s.tag,
                      {
                        backgroundColor: t.tagGoalBg,
                        borderColor: t.tagGoalBorder,
                      },
                    ]}
                  >
                    <Text style={[s.tagText, { color: t.tagGoalText }]}>
                      {goalLabel}
                    </Text>
                  </View>
                )}
                {dietLabel && (
                  <View
                    style={[
                      s.tag,
                      {
                        backgroundColor: t.tagDietBg,
                        borderColor: t.tagDietBorder,
                      },
                    ]}
                  >
                    <Text style={[s.tagText, { color: t.tagDietText }]}>
                      {dietLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Edit profile icon */}
            <Pressable
              onPress={() => {
                router.push("/(main)/edit-profile");
                onClose();
              }}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={15} color={t.editIcon} />
            </Pressable>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actions}>
          {/* New Chat */}
          <Pressable
            onPress={() => {
              onNewChat();
              onClose();
            }}
            style={[
              s.actionBtn,
              {
                backgroundColor: t.ncBg,
                borderWidth: 1,
                borderColor: t.ncBorder,
              },
            ]}
          >
            <View
              style={[s.actionIcon, { backgroundColor: "#bef135" }]}
            >
              <Ionicons name="add" size={13} color="#000" />
            </View>
            <Text style={[s.actionLabel, { color: t.ncLabel }]}>
              New Chat
            </Text>
          </Pressable>

          {/* Dashboard */}
          <Pressable
            onPress={() => {
              router.push("/(main)/dashboard");
              onClose();
            }}
            style={[
              s.actionBtn,
              {
                backgroundColor: t.dbBg,
                borderWidth: 1,
                borderColor: t.dbBorder,
              },
            ]}
          >
            <View style={[s.actionIcon, { backgroundColor: t.dbIconBg }]}>
              <Ionicons name="grid-outline" size={12} color={t.dbIconColor} />
            </View>
            <Text style={[s.actionLabel, { flex: 1, color: t.dbLabel }]}>
              Dashboard
            </Text>
            <Ionicons name="chevron-forward" size={13} color={t.dbArr} />
          </Pressable>

          {/* Aura Score */}
          <Pressable
            onPress={() => {
              router.push("/(main)/aura");
              onClose();
            }}
            style={[
              s.actionBtn,
              {
                backgroundColor: t.dbBg,
                borderWidth: 1,
                borderColor: t.dbBorder,
              },
            ]}
          >
            <View style={[s.actionIcon, { backgroundColor: t.dbIconBg }]}>
              <Ionicons name="sparkles-outline" size={12} color={t.dbIconColor} />
            </View>
            <Text style={[s.actionLabel, { flex: 1, color: t.dbLabel }]}>
              Aura Score
            </Text>
            <Ionicons name="chevron-forward" size={13} color={t.dbArr} />
          </Pressable>

          {/* Roast Mode */}
          <Pressable
            onPress={() => {
              router.push("/(main)/roast");
              onClose();
            }}
            style={[
              s.actionBtn,
              {
                backgroundColor: t.dbBg,
                borderWidth: 1,
                borderColor: t.dbBorder,
              },
            ]}
          >
            <View style={[s.actionIcon, { backgroundColor: t.dbIconBg }]}>
              <Ionicons name="flame-outline" size={12} color={t.dbIconColor} />
            </View>
            <Text style={[s.actionLabel, { flex: 1, color: t.dbLabel }]}>
              Roast Mode
            </Text>
            <Ionicons name="chevron-forward" size={13} color={t.dbArr} />
          </Pressable>

          {/* Beast Bets */}
          <Pressable
            onPress={() => {
              router.push("/(main)/bets");
              onClose();
            }}
            style={[
              s.actionBtn,
              {
                backgroundColor: t.dbBg,
                borderWidth: 1,
                borderColor: t.dbBorder,
              },
            ]}
          >
            <View style={[s.actionIcon, { backgroundColor: t.dbIconBg }]}>
              <Ionicons name="trophy-outline" size={12} color={t.dbIconColor} />
            </View>
            <Text style={[s.actionLabel, { flex: 1, color: t.dbLabel }]}>
              Beast Bets
            </Text>
            <Ionicons name="chevron-forward" size={13} color={t.dbArr} />
          </Pressable>
        </View>

        {/* ── Divider ── */}
        <View style={[s.divider, { backgroundColor: t.divider }]} />

        {/* ── Chats header ── */}
        <View style={s.convHead}>
          <Text style={[s.convTitle, { color: t.convTitle }]}>CHATS</Text>
          {conversations.length > 0 && (
            <View style={[s.convCount, { backgroundColor: t.convCountBg }]}>
              <Text style={[s.convCountText, { color: t.convCount }]}>
                {conversations.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Conversations list ── */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color="#bef135" size="small" />
            </View>
          ) : conversations.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: "center", paddingHorizontal: 24 }}>
              <Ionicons
                name="chatbubbles-outline"
                size={28}
                color={t.rowIconColor}
                style={{ marginBottom: 8 }}
              />
              <Text style={{ color: t.rowName, fontSize: 13, textAlign: "center" }}>
                No conversations yet
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label}>
                <Text style={[s.groupLabel, { color: t.group }]}>
                  {group.label}
                </Text>
                {group.items.map((conv) => {
                  const isActive = conv.id === currentConversationId;
                  const title = conv.title || "New conversation";
                  return (
                    <Pressable
                      key={conv.id}
                      onPress={() => {
                        onSelectConversation(conv);
                        onClose();
                      }}
                      style={[
                        s.row,
                        {
                          backgroundColor: isActive ? t.rowActiveBg : t.rowBg,
                        },
                      ]}
                    >
                      {/* Active accent bar */}
                      {isActive && <View style={s.activeBar} />}

                      <View
                        style={[
                          s.rowIcon,
                          {
                            backgroundColor: isActive
                              ? t.rowActiveIconBg
                              : t.rowIconBg,
                          },
                        ]}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={11}
                          color={
                            isActive
                              ? t.rowActiveIconColor
                              : t.rowIconColor
                          }
                        />
                      </View>
                      <Text
                        style={[
                          s.rowName,
                          {
                            color: isActive ? t.rowActiveName : t.rowName,
                            fontWeight: isActive ? "500" : "400",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                      <Text style={[s.rowDate, { color: t.rowDate }]}>
                        {formatDate(conv.created_at)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* ── Sign out ── */}
        <View
          style={[
            s.bottom,
            {
              borderTopColor: t.bottomBorder,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              onLogout();
              onClose();
            }}
            style={s.signout}
          >
            <View
              style={[s.signoutIcon, { backgroundColor: t.signoutIconBg }]}
            >
              <Ionicons
                name="log-out-outline"
                size={12}
                color={t.signoutIconColor}
              />
            </View>
            <Text style={[s.signoutLabel, { color: t.signoutLabel }]}>
              Sign out
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    flexDirection: "column",
  },

  // Profile
  profile: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarInitial: {
    color: "#bef135",
    fontSize: 17,
    fontStyle: "italic",
    fontWeight: "400",
  },
  name: {
    fontSize: 17,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  tags: {
    flexDirection: "row",
    gap: 5,
    marginTop: 4,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Actions
  actions: {
    paddingHorizontal: 12,
    gap: 6,
  },
  actionBtn: {
    height: 42,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  actionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 18,
    marginTop: 12,
  },

  // Conversations header
  convHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  convTitle: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 1.6,
  },
  convCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  convCountText: {
    fontSize: 9,
    fontWeight: "500",
  },

  // Group label
  groupLabel: {
    fontSize: 7,
    fontWeight: "500",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 3,
  },

  // Conversation row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginHorizontal: 10,
    borderRadius: 10,
    marginBottom: 1,
    position: "relative",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "50%",
    width: 2.5,
    height: 16,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: "#bef135",
    transform: [{ translateY: -8 }],
  },
  rowIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    flex: 1,
    fontSize: 11,
  },
  rowDate: {
    fontSize: 8,
    marginLeft: 4,
  },

  // Bottom
  bottom: {
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  signout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  signoutIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  signoutLabel: {
    fontSize: 12,
  },
});
