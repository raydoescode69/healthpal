import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { sendMessage, generateWelcome } from "../../lib/chatEngine";
import { analyzeFoodFromText } from "../../lib/foodAnalyzer";
import { QUICK_ACTIONS } from "../../lib/types";
import type { DietPlanData, ConversationItem, PinnedMessage, FoodAnalysisResult } from "../../lib/types";
import DietPlanCardComponent from "../../components/DietPlanCard";
import ChatSidebar from "../../components/ChatSidebar";
import FoodLogModal from "../../components/FoodLogModal";

// ── Display types ──────────────────────────────────────────────
interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  replyTo?: { id: string; content: string };
}

interface DietCardItem {
  id: string;
  type: "diet_card";
  plan: DietPlanData;
  created_at: string;
}

type FlatListItem = DisplayMessage | DietCardItem;

function isDietCard(item: FlatListItem): item is DietCardItem {
  return "type" in item && item.type === "diet_card";
}

// ── Typing dots ─────────────────────────────────────────────────
function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={style}
      className="w-[6px] h-[6px] rounded-full bg-[#555] mx-[2px]"
    />
  );
}

function TypingIndicator() {
  return (
    <View className="px-5 mb-3 items-start">
      <View className="bg-[#161616] rounded-2xl rounded-tl px-4 py-3 flex-row items-center">
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </View>
    </View>
  );
}

// ── Typewriter reveal ───────────────────────────────────────────
function useTypewriter(fullText: string, speed: number = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!fullText) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [fullText]);

  return { displayed, done };
}

// ── Message bubble ──────────────────────────────────────────────
function tryParseDietPlanFromText(text: string): DietPlanData | null {
  if (!text.includes('"type"') || !text.includes("DIET_PLAN")) return null;
  const match = text.match(/(\{[\s\S]*"type"\s*:\s*"DIET_PLAN"[\s\S]*)/);
  if (!match) return null;
  const fragment = match[1];
  let depth = 0;
  let jsonEnd = -1;
  for (let i = 0; i < fragment.length; i++) {
    if (fragment[i] === "{") depth++;
    else if (fragment[i] === "}") {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }
  if (jsonEnd === -1) return null;
  try {
    const cleaned = fragment.slice(0, jsonEnd + 1).replace(/[\n\r\t]/g, "").replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    const parsed = JSON.parse(cleaned);
    if (parsed?.type === "DIET_PLAN" && parsed?.days) return parsed as DietPlanData;
  } catch {}
  return null;
}

function MessageBubble({
  item,
  isPinned,
  onLongPress,
}: {
  item: DisplayMessage;
  isPinned?: boolean;
  onLongPress?: () => void;
}) {
  const isUser = item.role === "user";

  // Fallback: if assistant message contains DIET_PLAN JSON, render as card
  if (!isUser) {
    const embeddedPlan = tryParseDietPlanFromText(item.content);
    if (embeddedPlan) {
      return (
        <Pressable onLongPress={onLongPress} delayLongPress={400}>
          <DietPlanCardComponent
            plan={embeddedPlan}
            isPinned={isPinned}
          />
        </Pressable>
      );
    }
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`px-5 mb-2.5 ${isUser ? "items-end" : "items-start"}`}
    >
      {/* Reply reference */}
      {item.replyTo && (
        <View style={{
          maxWidth: "80%",
          paddingLeft: 10,
          marginBottom: 4,
          borderLeftWidth: 2,
          borderLeftColor: "#A8FF3E",
          alignSelf: isUser ? "flex-end" : "flex-start",
        }}>
          <Text style={{ color: "#666", fontSize: 12 }} numberOfLines={1}>
            {item.replyTo.content}
          </Text>
        </View>
      )}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-[#1A2E0A] rounded-br-sm"
            : "bg-[#161616] rounded-bl-sm"
        }`}
        style={isPinned ? { borderWidth: 1, borderColor: "#A8FF3E" } : undefined}
      >
        {isPinned && (
          <Text style={{ color: "#A8FF3E", fontSize: 10, marginBottom: 2 }}>
            {"\uD83D\uDCCC"} Pinned
          </Text>
        )}
        <Text
          className={`text-[15px] leading-[22px] font-dm ${
            isUser ? "text-[#D4E8BC]" : "text-[#C8C8C8]"
          }`}
        >
          {item.content}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Swipeable message wrapper ────────────────────────────────────
function SwipeableMessage({
  children,
  onSwipeReply,
}: {
  children: React.ReactNode;
  onSwipeReply: () => void;
}) {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const triggerReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwipeReply();
  }, [onSwipeReply]);

  const pan = Gesture.Pan()
    .activeOffsetX(15)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX * 0.6, 80);
        if (translateX.value >= 50 && !hasTriggered.value) {
          hasTriggered.value = true;
          runOnJS(triggerReply)();
        }
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      hasTriggered.value = false;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / 50, 1),
    transform: [{ scale: Math.min(translateX.value / 50, 1) }],
  }));

  return (
    <View>
      <Animated.View style={[{ position: "absolute", left: 8, top: 0, bottom: 0, justifyContent: "center" }, arrowStyle]}>
        <Text style={{ color: "#A8FF3E", fontSize: 18 }}>{"\u21A9"}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={animStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Draggable FAB ───────────────────────────────────────────────
const FAB_SIZE = 48;

function DraggableFAB({ onPress }: { onPress: () => void }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onPress)();
  });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
      scale.value = withSpring(1.1, { damping: 15 });
    })
    .onUpdate((e) => {
      translateX.value = offsetX.value + e.translationX;
      translateY.value = offsetY.value + e.translationY;
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 15 });
    });

  const gesture = Gesture.Race(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 16,
            right: 16,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: "#A8FF3E",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            elevation: 5,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
          animStyle,
        ]}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#000" }}>Log+</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Reply reference bubble ──────────────────────────────────────
function ReplyReference({ text }: { text: string }) {
  return (
    <View style={{
      marginHorizontal: 20,
      marginBottom: 2,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: "#A8FF3E",
    }}>
      <Text style={{ color: "#777", fontSize: 12 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ── Typewriter bot bubble ───────────────────────────────────────
function BotTypingBubble({
  fullText,
  onDone,
}: {
  fullText: string;
  onDone: () => void;
}) {
  const { displayed, done } = useTypewriter(fullText, 14);

  useEffect(() => {
    if (done) onDone();
  }, [done]);

  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-5 mb-2.5 items-start">
      <View className="max-w-[80%] bg-[#161616] rounded-2xl rounded-bl-sm px-4 py-2.5">
        <Text className="text-[15px] leading-[22px] font-dm text-[#C8C8C8]">
          {displayed}
          {!done && <Text className="text-brand-green">{"\u258D"}</Text>}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Pinned message banner (supports multiple) ──────────────────
function PinnedBanner({
  items,
  onTap,
  onUnpin,
}: {
  items: FlatListItem[];
  onTap: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#2a5a2a" }}>
      {items.map((item) => {
        const previewText = isDietCard(item)
          ? "\uD83E\uDD57 Your 7-Day Plan"
          : (item as DisplayMessage).content;
        return (
          <Pressable
            key={item.id}
            onPress={() => onTap(item.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1A2E0A",
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderBottomWidth: items.length > 1 ? 0.5 : 0,
              borderBottomColor: "#2a5a2a",
            }}
          >
            <Text style={{ color: "#A8FF3E", fontSize: 12, marginRight: 8 }}>{"\uD83D\uDCCC"}</Text>
            <Text
              style={{ flex: 1, color: "#D4E8BC", fontSize: 13 }}
              numberOfLines={1}
            >
              {previewText}
            </Text>
            <Pressable onPress={() => onUnpin(item.id)} hitSlop={8}>
              <Text style={{ color: "#666", fontSize: 16, marginLeft: 8 }}>{"\u2715"}</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Inline food prompt ──────────────────────────────────────────
function FoodPrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (food: string) => void;
  onCancel: () => void;
}) {
  const [food, setFood] = useState("");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#161616", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#222" }}>
      <TextInput
        value={food}
        onChangeText={setFood}
        placeholder="What did you eat?"
        placeholderTextColor="#555"
        autoFocus
        style={{ flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#1A1A1A", borderRadius: 8 }}
      />
      <Pressable
        onPress={() => food.trim() && onSubmit(food.trim())}
        style={{ marginLeft: 8, backgroundColor: "#1A2E0A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
      >
        <Text style={{ color: "#A8FF3E", fontWeight: "600", fontSize: 13 }}>Log</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: "#666", fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Inline water prompt ─────────────────────────────────────────
function WaterPrompt({
  onSelect,
  onCancel,
}: {
  onSelect: (count: number) => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#161616", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#222", gap: 8 }}>
      <Text style={{ color: "#888", fontSize: 13, marginRight: 4 }}>{"\uD83D\uDCA7"} Glasses:</Text>
      {[1, 2, 3, 4].map((n) => (
        <Pressable
          key={n}
          onPress={() => onSelect(n)}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? "#2a5a2a" : "#1A2E0A",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#2a5a2a",
          })}
        >
          <Text style={{ color: "#A8FF3E", fontWeight: "bold", fontSize: 16 }}>{n}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onCancel} style={{ marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: "#666", fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Main chat screen ────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { addWater, waterGlasses, saveFoodLog, loadTodayLogs } = useTrackingStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [listData, setListData] = useState<FlatListItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bubble queue state
  const [currentBubbleText, setCurrentBubbleText] = useState<string | null>(null);
  const bubbleQueueRef = useRef<string[]>([]);
  const pendingDietPlanRef = useRef<DietPlanData | null>(null);
  const isProcessingBubblesRef = useRef(false);

  // Conversation tracking
  const conversationIdRef = useRef<string>(Crypto.randomUUID());
  const conversationCreatedRef = useRef(false);
  const welcomeSent = useRef(false);

  // Diet plan shown flag
  const dietPlanShownRef = useRef(false);

  // Pin state — multiple pins, persisted to Supabase
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());

  // Inline prompt states
  const [showFoodPrompt, setShowFoodPrompt] = useState(false);
  const [showWaterPrompt, setShowWaterPrompt] = useState(false);
  const [showFoodLogModal, setShowFoodLogModal] = useState(false);

  // Reply state
  const [replyToMessage, setReplyToMessage] = useState<DisplayMessage | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Smart scroll tracking
  const isNearBottomRef = useRef(true);

  const getDietPlanKey = (convId: string) => `dietPlanShown_${convId}`;

  const markDietPlanShown = async (convId: string) => {
    dietPlanShownRef.current = true;
    try {
      await AsyncStorage.setItem(getDietPlanKey(convId), "true");
    } catch {}
  };

  const loadDietPlanFlag = async (convId: string) => {
    try {
      const val = await AsyncStorage.getItem(getDietPlanKey(convId));
      dietPlanShownRef.current = val === "true";
    } catch {
      dietPlanShownRef.current = false;
    }
  };

  const userId = session?.user?.id || "";

  // Sync listData when messages change
  useEffect(() => {
    setListData([...messages]);
  }, [messages]);

  // ── Load chat history + food logs on mount ──────────────────
  useEffect(() => {
    if (!userId) return;
    loadLatestConversation();
    loadTodayLogs(userId);
  }, [userId]);

  const loadLatestConversation = async () => {
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const latestConv = convs[0];
        conversationIdRef.current = latestConv.id;
        conversationCreatedRef.current = true;
        await loadDietPlanFlag(latestConv.id);
        loadPinnedMessages(latestConv.id);

        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", userId)
          .eq("conversation_id", latestConv.id)
          .order("created_at", { ascending: true })
          .limit(50);

        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setLoadingHistory(false);
          return;
        }
      }

      setLoadingHistory(false);
      sendWelcome();
    } catch {
      setLoadingHistory(false);
      sendWelcome();
    }
  };

  // ── Create conversation in DB ──────────────────────────────
  const ensureConversation = async (title: string) => {
    if (conversationCreatedRef.current || !userId) return;
    conversationCreatedRef.current = true;
    try {
      const { error } = await supabase.from("conversations").insert({
        id: conversationIdRef.current,
        user_id: userId,
        title: title.slice(0, 40),
      });
      if (error) console.warn("[DB] Create conversation failed:", error.message);
      else console.log("[DB] Conversation created:", conversationIdRef.current);
    } catch (e) {
      console.warn("[DB] Create conversation error:", e);
    }
  };

  // ── Welcome message ────────────────────────────────────────
  const sendWelcome = async () => {
    if (welcomeSent.current || !userId) return;
    welcomeSent.current = true;
    setShowTypingIndicator(true);

    try {
      const welcomeText = await generateWelcome(userId);
      setShowTypingIndicator(false);

      const welcomeId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: welcomeId,
        role: "assistant",
        content: welcomeText,
        created_at: new Date().toISOString(),
      };

      setMessages([botMsg]);
      setCurrentBubbleText(welcomeText);
      saveMessage("assistant", welcomeText, welcomeId);
    } catch {
      setShowTypingIndicator(false);
      const fallbackMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "yo bhai! kya scene hai? health related kuch bhi puchna ho toh bol \uD83D\uDCAA",
        created_at: new Date().toISOString(),
      };
      setMessages([fallbackMsg]);
    }
  };

  // ── New chat ───────────────────────────────────────────────
  const handleNewChat = () => {
    if (isLoading) return;

    conversationIdRef.current = Crypto.randomUUID();
    conversationCreatedRef.current = false;
    dietPlanShownRef.current = false;

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);
    setReplyToMessage(null);

    welcomeSent.current = false;
    sendWelcome();
  };

  // ── Load a specific conversation ───────────────────────────
  const handleSelectConversation = async (conv: ConversationItem) => {
    if (isLoading) return;

    conversationIdRef.current = conv.id;
    conversationCreatedRef.current = true;
    await loadDietPlanFlag(conv.id);

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);
    setReplyToMessage(null);

    loadPinnedMessages(conv.id);

    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      }
    } catch {}
  };

  // ── Save message to DB ─────────────────────────────────────
  const saveMessage = async (role: "user" | "assistant", content: string, msgId?: string) => {
    if (!userId) return;
    try {
      const row: Record<string, string> = {
        user_id: userId,
        role,
        content,
        conversation_id: conversationIdRef.current,
      };
      if (msgId) row.id = msgId;
      const { error } = await supabase.from("messages").insert(row);
      if (error) console.warn("[DB] Save message failed:", error.message);
      else console.log("[DB] Message saved:", role, content.slice(0, 40));
    } catch (e) {
      console.warn("[DB] Save message error:", e);
    }
  };

  // ── Scroll helpers ─────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    if (isNearBottomRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    }
  }, []);

  const forceScrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  // ── Handle personalize button ──────────────────────────────
  const handlePersonalize = useCallback(() => {
    handleSend("yes, customize my diet plan");
  }, []);

  // ── Load pinned messages from Supabase ──────────────────────
  const loadPinnedMessages = useCallback(async (convId: string) => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("pinned_messages")
        .select("message_id")
        .eq("conversation_id", convId)
        .eq("user_id", userId);
      if (data) {
        setPinnedMessageIds(new Set(data.map((r: { message_id: string }) => r.message_id)));
      } else {
        setPinnedMessageIds(new Set());
      }
    } catch {
      setPinnedMessageIds(new Set());
    }
  }, [userId]);

  // ── Pin / unpin a message (persisted) ─────────────────────
  const handlePinMessage = useCallback(async (messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const convId = conversationIdRef.current;
    const wasPinned = pinnedMessageIds.has(messageId);

    // Optimistic update
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      if (wasPinned) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });

    try {
      if (wasPinned) {
        const { error } = await supabase
          .from("pinned_messages")
          .delete()
          .eq("conversation_id", convId)
          .eq("message_id", messageId)
          .eq("user_id", userId);
        if (error) {
          console.warn("[Pin] Unpin failed:", error.message);
          throw error;
        }
        console.log("[Pin] Unpinned:", messageId);
      } else {
        const { error } = await supabase
          .from("pinned_messages")
          .upsert({
            conversation_id: convId,
            message_id: messageId,
            user_id: userId,
          }, { onConflict: "conversation_id,message_id" });
        if (error) {
          console.warn("[Pin] Pin failed:", error.message);
          throw error;
        }
        console.log("[Pin] Pinned:", messageId);
      }
    } catch {
      // Revert on failure
      setPinnedMessageIds((prev) => {
        const reverted = new Set(prev);
        if (wasPinned) reverted.add(messageId);
        else reverted.delete(messageId);
        return reverted;
      });
    }
  }, [pinnedMessageIds, userId]);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    const convId = conversationIdRef.current;
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    try {
      await supabase
        .from("pinned_messages")
        .delete()
        .eq("conversation_id", convId)
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } catch {}
  }, [userId]);

  const handleScrollToPinned = useCallback((messageId: string) => {
    const index = listData.findIndex((item) => item.id === messageId);
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  }, [listData]);

  // Resolve pinned items for the banner (messages + diet cards)
  const pinnedItems: FlatListItem[] = listData.filter(
    (item) => pinnedMessageIds.has(item.id)
  );

  // ── Swipe to reply handler ─────────────────────────────────
  const handleSwipeReply = useCallback((item: DisplayMessage) => {
    setReplyToMessage(item);
    inputRef.current?.focus();
  }, []);

  // ── Logout handler ─────────────────────────────────────────
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    logout();
    router.replace("/(auth)");
  };

  // ── Process bubble queue ───────────────────────────────────
  const processBubbleQueue = useCallback(() => {
    if (isProcessingBubblesRef.current) return;
    if (bubbleQueueRef.current.length === 0) {
      if (pendingDietPlanRef.current) {
        const plan = pendingDietPlanRef.current;
        pendingDietPlanRef.current = null;
        setListData((prev) => [
          ...prev,
          {
            id: `diet-${Date.now()}`,
            type: "diet_card" as const,
            plan,
            created_at: new Date().toISOString(),
          },
        ]);
        scrollToEnd();
      }
      setIsLoading(false);
      return;
    }

    isProcessingBubblesRef.current = true;
    const nextText = bubbleQueueRef.current.shift()!;

    setShowTypingIndicator(true);
    scrollToEnd();

    setTimeout(() => {
      setShowTypingIndicator(false);

      const botMsgId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: botMsgId,
        role: "assistant",
        content: nextText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", nextText, botMsgId);
      setCurrentBubbleText(nextText);
      scrollToEnd();
    }, 700);
  }, [scrollToEnd]);

  const handleBubbleDone = useCallback(() => {
    setCurrentBubbleText(null);
    isProcessingBubblesRef.current = false;

    setTimeout(() => {
      processBubbleQueue();
    }, 200);
  }, [processBubbleQueue]);

  // ── Send message ───────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const rawContent = (text ?? input).trim();
    if (!rawContent || isLoading) return;

    Keyboard.dismiss();
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);

    // Prepend quoted reply text for AI context
    const replyRef = replyToMessage;
    const content = replyRef
      ? `> ${replyRef.content.slice(0, 120)}\n\n${rawContent}`
      : rawContent;

    const userMsgId = Crypto.randomUUID();
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: rawContent,
      created_at: new Date().toISOString(),
      replyTo: replyRef ? { id: replyRef.id, content: replyRef.content.slice(0, 80) } : undefined,
    };

    setReplyToMessage(null);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setShowTypingIndicator(true);
    setCurrentBubbleText(null);
    forceScrollToEnd();

    ensureConversation(rawContent);
    saveMessage("user", content, userMsgId);

    const messageHistory = messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const response = await sendMessage(
        userId,
        conversationIdRef.current,
        content,
        messageHistory,
        dietPlanShownRef.current
      );

      setShowTypingIndicator(false);

      if (response.dietPlan) {
        pendingDietPlanRef.current = response.dietPlan;
        markDietPlanShown(conversationIdRef.current);
      }

      bubbleQueueRef.current = [...response.bubbles];
      isProcessingBubblesRef.current = false;
      processBubbleQueue();
    } catch {
      setShowTypingIndicator(false);
      setIsLoading(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "arre yaar connection issue lag raha hai \uD83D\uDE05 internet check karke try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // ── Quick action handlers ──────────────────────────────────
  const handleQuickAction = (label: string) => {
    switch (label) {
      case "Log Food":
        setShowWaterPrompt(false);
        setShowFoodPrompt(false);
        setShowFoodLogModal(true);
        break;
      case "My Plan": {
        // Find existing diet card in listData
        const dietIndex = listData.findIndex((item) => isDietCard(item));
        if (dietIndex >= 0) {
          flatListRef.current?.scrollToIndex({ index: dietIndex, animated: true, viewPosition: 0.3 });
        } else {
          handleSend("give me a diet plan");
        }
        break;
      }
      case "Motivate me":
        handleSend("Motivate me");
        break;
      case "Water intake":
        setShowFoodPrompt(false);
        setShowWaterPrompt(true);
        break;
      default:
        handleSend(label);
    }
  };

  const handleFoodSubmit = async (food: string) => {
    setShowFoodPrompt(false);
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);

      // Add user message to chat
      const foodUserMsgId = Crypto.randomUUID();
      const userMsg: DisplayMessage = {
        id: foodUserMsgId,
        role: "user",
        content: `I ate: ${food}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      forceScrollToEnd();
      ensureConversation(food);
      saveMessage("user", `I ate: ${food}`, foodUserMsgId);

      const result = await analyzeFoodFromText(food);
      await saveFoodLog(userId, result);

      setShowTypingIndicator(false);

      const confirmText = `Logged: ${result.food_name} \u2014 ${result.calories} cal, ${result.protein_g}g P, ${result.carbs_g}g C, ${result.fat_g}g F \u2705`;
      const foodBotMsgId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: foodBotMsgId,
        role: "assistant",
        content: confirmText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", confirmText, foodBotMsgId);
      setCurrentBubbleText(confirmText);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "arre yaar food analyze nahi ho paya \uD83D\uDE05 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFoodAnalyzed = async (result: FoodAnalysisResult, imageUri?: string) => {
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);
      forceScrollToEnd();

      await saveFoodLog(userId, result, imageUri);

      setShowTypingIndicator(false);

      const confirmText = `Logged: ${result.food_name} \u2014 ${result.calories} cal, ${result.protein_g}g P, ${result.carbs_g}g C, ${result.fat_g}g F \u2705`;
      const analyzeBotId = Crypto.randomUUID();
      const botMsg: DisplayMessage = {
        id: analyzeBotId,
        role: "assistant",
        content: confirmText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      ensureConversation(result.food_name);
      saveMessage("assistant", confirmText, analyzeBotId);
      setCurrentBubbleText(confirmText);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: Crypto.randomUUID(),
        role: "assistant",
        content: "food save nahi ho paya bhai \uD83D\uDE15 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaterSelect = (count: number) => {
    setShowWaterPrompt(false);
    addWater(count);
    const total = waterGlasses + count;
    handleSend(`I just drank ${count} glass${count > 1 ? "es" : ""} of water. Total today: ${total} glasses.`);
  };

  // ── Loading screen ─────────────────────────────────────────
  if (loadingHistory) {
    return (
      <View className="flex-1 bg-brand-dark items-center justify-center">
        <ActivityIndicator color="#A8FF3E" size="small" />
      </View>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const isLastBubbleTyping =
    currentBubbleText !== null &&
    lastMsg?.role === "assistant" &&
    lastMsg?.content === currentBubbleText;

  return (
    <View className="flex-1 bg-brand-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
      >
        {/* Header */}
        <View
          style={{ paddingTop: insets.top + 6 }}
          className="px-5 pb-3 border-b border-[#151515]"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
            >
              <Text className="text-[18px] text-[#888]">{"\u2630"}</Text>
            </Pressable>

            <View className="flex-row items-center">
              <Text className="text-[17px] text-white font-sora-semibold">
                Pal {"\uD83C\uDF3F"}
              </Text>
            </View>

            <View className="w-9 h-9" />
          </View>
        </View>

        {/* Pinned message banners */}
        {pinnedItems.length > 0 && (
          <PinnedBanner
            items={pinnedItems}
            onTap={handleScrollToPinned}
            onUnpin={handleUnpinMessage}
          />
        )}

        {/* Messages + FAB container */}
        <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            if (isDietCard(item)) {
              return (
                <DietPlanCardComponent
                  plan={item.plan}
                  onPersonalize={!item.plan.is_personalized ? handlePersonalize : undefined}
                  onLongPress={() => handlePinMessage(item.id)}
                  isPinned={pinnedMessageIds.has(item.id)}
                />
              );
            }

            if (
              isLastBubbleTyping &&
              index === listData.length - 1 &&
              !isDietCard(item)
            ) {
              return (
                <BotTypingBubble
                  fullText={currentBubbleText!}
                  onDone={handleBubbleDone}
                />
              );
            }

            const msgItem = item as DisplayMessage;
            return (
              <SwipeableMessage onSwipeReply={() => handleSwipeReply(msgItem)}>
                <MessageBubble
                  item={msgItem}
                  isPinned={pinnedMessageIds.has(item.id)}
                  onLongPress={() => handlePinMessage(item.id)}
                />
              </SwipeableMessage>
            );
          }}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 8,
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
              });
            }, 200);
          }}
        />

        {/* Draggable Floating Log Food FAB — shown once chat has started */}
        {messages.length > 1 && <DraggableFAB onPress={() => setShowFoodLogModal(true)} />}
        </View>

        {/* Typing indicator */}
        {showTypingIndicator && <TypingIndicator />}

        {/* Inline prompts */}
        {showFoodPrompt && (
          <FoodPrompt
            onSubmit={handleFoodSubmit}
            onCancel={() => setShowFoodPrompt(false)}
          />
        )}
        {showWaterPrompt && (
          <WaterPrompt
            onSelect={handleWaterSelect}
            onCancel={() => setShowWaterPrompt(false)}
          />
        )}

        {/* Bottom bar */}
        <View
          style={{ paddingBottom: insets.bottom + 4 }}
          className="border-t border-[#151515] bg-brand-dark"
        >
          {/* Quick chips — hidden once chat has started */}
          {messages.length <= 1 && (
            <View className="flex-row px-4 pt-2.5 pb-2">
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => handleQuickAction(action.label)}
                  disabled={isLoading}
                  className="bg-[#111] border border-[#1C1C1C] rounded-full px-3 py-1.5 mr-1.5 active:opacity-60"
                >
                  <Text className="text-[12px] text-[#777] font-dm">
                    {action.icon} {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Reply preview bar */}
          {replyToMessage && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#161616",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderLeftWidth: 3,
              borderLeftColor: "#A8FF3E",
              marginHorizontal: 16,
              marginBottom: 4,
              borderRadius: 8,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#A8FF3E", fontSize: 11, fontWeight: "600", marginBottom: 2 }}>
                  Replying to
                </Text>
                <Text style={{ color: "#999", fontSize: 13 }} numberOfLines={1}>
                  {replyToMessage.content}
                </Text>
              </View>
              <Pressable onPress={() => setReplyToMessage(null)} hitSlop={8}>
                <Text style={{ color: "#666", fontSize: 18, marginLeft: 12 }}>{"\u2715"}</Text>
              </Pressable>
            </View>
          )}

          {/* Input */}
          <View className="px-4 pb-1.5">
            <View className="flex-row items-end bg-[#111] rounded-full border border-[#1C1C1C] pl-4 pr-1.5 py-0.5">
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Message..."
                placeholderTextColor="#333"
                multiline
                maxLength={1000}
                className="flex-1 text-white font-dm text-[15px] py-2.5 max-h-24"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => handleSend()}
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`ml-1.5 mb-1 w-9 h-9 rounded-full items-center justify-center active:opacity-70 ${
                  input.trim() && !isLoading
                    ? "bg-brand-green"
                    : "bg-[#1A1A1A]"
                }`}
              >
                <Text
                  className={`text-base font-bold ${
                    input.trim() && !isLoading
                      ? "text-black"
                      : "text-[#333]"
                  }`}
                >
                  {"\u2191"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Food log modal */}
      <FoodLogModal
        visible={showFoodLogModal}
        onClose={() => setShowFoodLogModal(false)}
        onTypeFood={() => setShowFoodPrompt(true)}
        onFoodAnalyzed={handleFoodAnalyzed}
      />

      {/* Sidebar overlay */}
      <ChatSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        currentConversationId={conversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        profile={profile}
        onLogout={handleLogout}
      />
    </View>
  );
}
